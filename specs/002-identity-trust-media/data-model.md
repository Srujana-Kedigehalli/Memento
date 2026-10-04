# Data Model: Identity, Trust & Media Handling

Field lists and rules only; the migration itself is an implementation task. All ids are `uuid`
(`gen_random_uuid()`), all timestamps `timestamptz`. Raw SQL via `pg`.

## Entities

### hosts
`id`, `email` (case-insensitive unique, nullable after tombstone), `email_verified_at` (null =
unverified), `password_hash` (bcrypt, nullable after tombstone), `failed_login_count`,
`locked_until`, `created_at`, `deleted_at`, `purge_after`.
Rules: email normalized (trim, lowercase) before insert; soft delete sets `deleted_at` and
`purge_after = now() + 30 days`; login refused when `deleted_at` is set. Five consecutive login
failures set `locked_until = now() + 15 minutes`; success resets `failed_login_count`. A completed
password reset also clears both and, if the email was unverified, sets `email_verified_at` (the reset
link proved the host controls the inbox). `email_verified_at` never gates any action: it only drives
the dashboard reminder. At purge, a host referenced by harmful evidence (as
`reports.reviewed_by` or `reports.uploader_host_id`) is **tombstoned** (email and password hash
cleared, row kept) instead of deleted.

### host_sessions
`id`, `host_id` → hosts (cascade), `token_hash` (unique), `created_at`, `expires_at`,
`last_seen_at`.

### password_reset_tokens
`id`, `host_id` → hosts (cascade), `token_hash` (unique, SHA-256 of a 32-byte random token; the
token itself is never stored), `created_at`, `expires_at` (30 minutes), `used_at`.
Rules: creating a token invalidates the host's other unused tokens (only the newest link works); at
most 3 tokens per host per rolling hour (further requests still get the uniform response but create
nothing); a token works once, and only while unexpired and unused; completing a reset deletes all
of the host's `host_sessions`. Expired or used rows are swept daily.

### email_verification_tokens
`id`, `host_id` → hosts (cascade), `token_hash` (unique, SHA-256 of a 32-byte random token; the token
itself is never stored), `created_at`, `expires_at` (7 days), `used_at`.
Rules: one is created at signup; a host can request a new one, which invalidates their other unused
tokens (only the newest link works); at most 3 tokens per host per rolling hour; a token works once,
and only while unexpired and unused; using it sets `hosts.email_verified_at`. Expired or used rows
are swept daily.

### events
`id`, `name`, `event_date`, `access_token` (unique, rotatable, separate from `id`), `closed_at`
(null = open), `created_at`, `deleted_at`, `purge_after`.
Rules: soft-deleted events are invisible to guests and hosts' active lists; restorable until
`purge_after`. `closed_at` set means the event accepts **no new uploads from anyone**, checked when an
upload intent is requested **and again at finalize** (an upload started before the close is refused).
Viewing, reporting, review, and deletion are unaffected by `closed_at`. The owner can clear it to
reopen.

### event_hosts
`event_id` → events, `host_id` → hosts, `role` (`'owner'`), primary key `(event_id, host_id)`.
`event_id` is `ON DELETE CASCADE`: this is a plain join table, and nothing should block deleting an event
because of it. `host_id` has no cascade.
Rules: the app creates exactly one `owner` row per event today; the schema is ready for co-hosts
later (a deliberate decision, not scope creep). Ownership checks always go through this table.

### guests
`id`, `identifier` (text: the guest's verified address on their channel, normalized by the provider;
nullable after tombstone), `channel` (text: `'email'` today, `'phone'` anticipated; nullable after
tombstone), `verified_at` (timestamptz; nullable after tombstone), `name` (text, nullable, optional),
`created_at`, `deleted_at`.
Constraints: **UNIQUE `(identifier, channel)`** (allows many nulls); `CHECK` that `identifier`,
`channel`, and `verified_at` are all null or all set. There is **no email column and no phone column**,
and `channel` has no `CHECK` on its values (the provider layer validates), so a new channel needs no
migration.
Rules: lookup and creation at verification time is **by `(identifier, channel)`**, where the identifier
is the provider-normalized value returned by `verify` and the channel is the configured one. A future
phone channel adds rows with `channel = 'phone'`; existing email-verified guests are untouched; no
migration is needed. A person who verifies on two channels is two guest identities unless a linking
policy is later decided (open item). **Identity deletion tombstones the row** (`identifier`, `channel`,
and `verified_at` cleared, `deleted_at` set) rather than deleting it, so `media` and `reports`
references stay valid. **Everything else refers to a guest by `id` only** (sessions, consent,
`event_guests`, media, reports, evidence): the identifier is read only by the verification module and
the find-or-create step at verification. `name` is never set or required at verification; a new guest
row has `name = NULL`. It is set only through the optional prompt shown after a successful upload (spec
FR-039) and may be skipped. Identity deletion **keeps** `name`, so the guest's photos display exactly
as before; a photo whose uploader has no name displays as anonymous, with no "deleted" label. Name
rules: trimmed, 1 to 60 characters, no control characters, validated on the server; an empty
submission stores nothing.

### guest_sessions
`id`, `guest_id` → guests (cascade), `token_hash` (unique), `created_at`, `expires_at`,
`last_seen_at`.

### otp_codes
`id`, `identifier` (the address the code was sent to: an email address while the email channel is
active, or a phone number if a phone channel is ever activated), `code_hash` (HMAC with
`VERIFICATION_PEPPER`, never the code), `expires_at` (10 minutes), `attempt_count`, `created_at`,
`used_at`, `is_resend` (true when this send happened while an earlier code for the same identifier was
still valid and unused). Same structure as the original OTP table, with the identifier column
generalized and one flag added.
Used by the built-in `EmailOtpProvider`. Rules: a send while no valid unused code exists is a **new
code**; a send while one does is a **resend**. Older unused codes stay valid until they expire (at most
3 valid at once, the oldest dropped), so a stranger's request cannot cancel a real guest's pending
code; verification checks the submitted code against the identifier's valid codes. Verification
increments `attempt_count` and a code fails at 5 attempts; expired or used rows never verify. Rows are
kept for at least 25 hours **regardless of expired or used status** (housekeeping deletes only older rows) because they also drive the throttles:
per identifier, new codes (5 per hour), resends (10 per hour, at least 30 seconds apart, not counted
against the new-code limit), and 10 verification attempts across codes per hour; and system-wide, the
daily verification-email cap (see validation rules).

### event_guests
`event_id` → events (cascade), `guest_id` → guests, `consented_at`, `consent_version`, primary
key `(event_id, guest_id)`.
Rules: a row exists only after consent; upload requires a row whose `consent_version` equals the
current version constant. Consent never carries across events.

### media
`id`, `event_id` → events, `guest_id` → guests (nullable), `host_id` → hosts (nullable),
`content_hash` (SHA-256 of the original upload), `storage_path`, `thumbnail_path` (processed
files only, never the raw original), `mime_type`, `byte_size`, `width`, `height`, `visibility`
(`visible` | `hidden`), `created_at`, `deleted_at`, `purge_after`.
**Deliberately no `ON DELETE CASCADE` from `events` to `media`** (unlike `event_hosts`): the purge
sequence (detach harmful evidence, delete media explicitly, then delete the event) must stay in the
application's control, so the database never silently cascades media away before evidence has been
detached. Do not "fix" this to match `event_hosts`. The migration carries the same note as SQL
comments.
Constraints:
- `CHECK (num_nonnulls(guest_id, host_id) = 1)` — exactly one uploader.
- Partial unique index `(event_id, content_hash) WHERE deleted_at IS NULL` — exact-duplicate
  dedupe, race-proof.
Rules: gallery lists `visibility = 'visible' AND deleted_at IS NULL`. Uploader deletion sets
`deleted_at` and `purge_after` (short grace). The owning host of the event may delete any photo in it
the same way; doing so closes any open reports on it as `upheld`. Upheld reports also queue the media
for purge. Display
attribution for a guest's photo is `guests.name`, or anonymous when null; it never depends on whether
the guest's identity was deleted.

### upload_intents
`id`, `event_id` → events (cascade), `guest_id` (nullable), `host_id` (nullable), `temp_path`,
`declared_mime`, `created_at`, `expires_at` (15 min), `finalized_at`.
Constraint: `CHECK (num_nonnulls(guest_id, host_id) = 1)`.
Rules: finalize requires an unexpired, unfinalized intent belonging to the caller, for an event that
is still open. Guest intents double as the upload-limit counter: creating one counts against the
guest's limit for that event whether or not it is ever finalized. Host intents are not limited.
Index `(guest_id, event_id, created_at)` serves the count.

### reports
`id`, `media_id` → media (**nullable**, `ON DELETE SET NULL`), `event_id` → events (**nullable**,
`ON DELETE SET NULL`), `reporter_guest_id` → guests (nullable, `ON DELETE RESTRICT`), **`reporter_host_id`** → hosts
(nullable, `ON DELETE RESTRICT`), `reason`, `note` (optional,
length-capped), `status`, `created_at`, `resolved_at`, `reviewed_by` → hosts (nullable,
`ON DELETE RESTRICT`), **`uploader_guest_id`** → guests (nullable, `ON DELETE RESTRICT`),
**`uploader_host_id`** → hosts (nullable, `ON DELETE RESTRICT`), **`content_hash`** (copy of the
media's hash), `alerted_at` (harmful-report email sent), `auto_hold_notified_at` (auto-hold digest
email sent).
The uploader columns and `content_hash` are **copied from the media in the same transaction that files
the report**, so they exist before any purge and nothing needs reconstructing afterwards. The same transaction
begins with `SELECT … FOR UPDATE` on the media row, so a simultaneous uploader or host deletion cannot
slip past the deleted-media check and leave a report on removed media.
All people references (`reporter_guest_id`, `reporter_host_id`, `reviewed_by`, `uploader_*`) are plain foreign keys, not hashes
or snapshots.
Constraints:
- `CHECK (reason IN ('self_removal','inappropriate','harmful','other'))` — text, not an enum.
- `CHECK (status IN ('open','upheld','dismissed','auto_held'))`.
- `CHECK (num_nonnulls(uploader_guest_id, uploader_host_id) = 1)`.
- `CHECK (num_nonnulls(reporter_guest_id, reporter_host_id) = 1)` — a guest filed it, or the owning
  host did (a host-marked removal).
- Partial unique index `(media_id, reporter_guest_id) WHERE status = 'open'` — no duplicate open report
  by one guest on one photo.
- Index `(reporter_guest_id, event_id, created_at)` — serves the per-guest report limit.
Derived: **harmful evidence** = `reason = 'harmful' AND status IN ('upheld','auto_held')`. It keeps:
the report (reason, status, times), `reporter_guest_id` or `reporter_host_id`, `reviewed_by`, the uploader, and `content_hash`.
Auto-resolve (`auto_held`) applies to every open report after 72 hours; only evidence retention is
specific to harmful reports.

## Relationships

```text
hosts 1─* host_sessions
hosts 1─* password_reset_tokens
hosts 1─* email_verification_tokens
hosts 1─* event_hosts *─1 events
events 1─* media *─1 (guests | hosts)     exactly one uploader
events 1─* event_guests *─1 guests        consent per event
guests 1─* guest_sessions
media 1─* reports            (nullable: evidence outlives its media)
reports ─ reporter (guest), reviewer (host), uploader (guest | host)   plain foreign keys
events 1─* upload_intents
```

## State transitions

**Report** (`auto_held` below is called "auto-resolved" in the spec): `open` → `upheld` (host, photo stays hidden, queued for purge) | `dismissed` (host,
photo restored to `visible`) | `auto_held` (sweep, 72 hours elapsed with no review, any reason,
photo stays hidden).
A dismissed or auto-held-then-reviewed state is final; there is no reopen in this feature.

**Host-marked removal**: when the owning host deletes a photo and marks it harmful, one `reports` row
is inserted directly as `status = 'upheld'`, `reason = 'harmful'`, `reporter_host_id` and
`reviewed_by` both the host, uploader and `content_hash` copied from the media, `resolved_at` now.
It is never `open`, so it is in no review queue, does not count toward the guest report limit,
sends no email, and is harmful evidence like any upheld report. A deletion not marked harmful
creates no row. The media row is locked in the same transaction so a simultaneous guest report
cannot produce a second outcome.

**Media visibility**: `visible` → `hidden` (report filed, same transaction) → `visible`
(dismissed) or purged (upheld, uploader deletion, event purge).

**Event upload state**: open (`closed_at` null) ⇄ closed (`closed_at` set), toggled by the owner.
Independent of soft delete.

**Soft delete (events, hosts)**: active → `deleted_at` set (hidden immediately, restorable) →
purged by the sweep after `purge_after`. Host account deletion applies the same pattern to the host
and all their events.

## Purge and evidence retention

Per target (media or event), in one transaction:
1. Open harmful reports → `auto_held` (fail safe).
2. Harmful evidence: set `media_id` and `event_id` to null. These rows persist with `reporter_guest_id` or `reporter_host_id`,
   `reviewed_by`, `uploader_guest_id` / `uploader_host_id`, `content_hash`, reason, status and
   timestamps intact.
3. Delete every other report on the target.
4. Delete media rows and Storage objects, then the event.
`media_id` and `event_id` are `SET NULL`, not `CASCADE`, so a missed step can never delete
evidence. This is the same reason `media` has no cascade from `events` (contrast `event_hosts`). Non-harmful reports and dismissed harmful reports are removed with the event (FR-032).
Guests and hosts referenced by evidence (as reporter, reviewer, or uploader) are tombstoned, never
hard-deleted, so the `RESTRICT` foreign keys hold. Because non-harmful reports are deleted first,
they never block a purge. After tombstoning, the evidence still points to the person by id, but their
identifier or email is gone.

## Validation rules (server-side, from spec)

- Email: valid shape, max 254 chars. Password: 10 to 72 bytes (also on reset).
- Reset and verification tokens: 43-character base64url string; anything else is rejected before
  lookup.
- Guest identifier: validated and normalized by the active provider (email channel: valid shape,
  max 254 characters, trimmed, lowercase), stored in `guests.identifier` (with `channel = 'email'`). Verification code: exactly 6 digits.
- Verification sends: new codes at most 5 per identifier per rolling hour; resends (while a previous
  code is still valid and unused) at most 10 per identifier per rolling hour and at least 30 seconds
  apart, not counted against the new-code limit; at most 400 verification emails system-wide per rolling
  day (configurable via `VERIFICATION_DAILY_CAP`), with no short-window system-wide limit, so one
  reception's worth of guests can verify together while leaving room under a shared mail allowance for
  safety alerts. Alerts and notices are never counted.
- Guest name: 1 to 60 characters after trimming, no control characters.
- Report reason: one of the four values; note max 500 chars. A guest may file at most 5 reports per
  event per rolling 15 minutes, counted over all of their reports regardless of outcome.
- Upload: real file type sniffed from bytes (JPEG, PNG, WebP, HEIC/HEIF), size 25 MB max
  (assumption), rejected before any row is created; refused with `event_closed` when the event is
  closed.
- Upload limit: a guest may create at most 200 upload intents per event per rolling hour, counted
  over all of their intents in that event whether finalized or not. Hosts are exempt.
- Every id in a path or body: valid UUID or token format; unknown fields ignored.
