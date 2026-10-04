# Research: Identity, Trust & Media Handling

Each entry: Decision, Rationale, Alternatives considered. Items marked **FLAG** are not decided
by the brief; they carry a proposal, not a commitment.

## R1. Host password hashing

- **Decision**: bcrypt via `bcryptjs`, cost 12. Minimum password length 10, maximum 72 bytes
  (bcrypt truncates past 72, so reject longer instead of silently truncating).
- **Rationale**: the brief specifies bcrypt. The pure-JS build avoids native compile problems on
  Vercel; cost 12 is a few hundred ms per login, fine at this scale.
- **Alternatives**: native `bcrypt` (build friction), argon2 (not requested).

## R2. Session tokens (host and guest)

- **Decision**: 32 random bytes (base64url) in an httpOnly, `SameSite=Lax`, `Secure` cookie. The
  database stores only the SHA-256 of the token. Lookup is by hash; expiry checked in SQL.
  Host sessions 12 hours sliding; guest sessions 180 days (**FLAG**, item 9).
- **Rationale**: tokens are high-entropy, so a fast hash is sufficient (bcrypt would add cost with
  no benefit). No JWTs and no plaintext tokens, per constitution VII.
- **Alternatives**: signed cookies (no server revocation), JWT (forbidden).

## R3. Auth helpers

- **Decision**: `requireHost()`, `requireGuest()`, `requireEventHost(eventId)`,
  `resolveEventByToken(token)` in `lib/auth/guards.ts`. Each returns the identity or throws a typed
  error mapped to 401/403/404. `requireEventHost` checks `event_hosts` and `events.deleted_at`.
  Routes use them as the only path to identity; no route reads cookies directly.
- **Rationale**: one enforcement point makes tenant scoping (constitution I) auditable.

## R4. Event access token

- **Decision**: `events.access_token` is 16 random bytes base64url, unique, separate from the
  internal `id`. Guest URLs use the token (`/e/<token>`). Rotating it invalidates old links.
- **Rationale**: viewing is open to anyone with the link, so the link must be unguessable and
  revocable. Internal ids never leave the host dashboard.

## R5. Image processing and HEIC

- **Decision**: pipeline is: fetch raw bytes → SHA-256 → sniff real type from magic bytes (not the
  client MIME) → if HEIC/HEIF, decode with `heic-convert` to JPEG → `sharp().rotate()` (apply EXIF
  orientation first) → strip all metadata (sharp drops it unless `withMetadata` is called) →
  encode display JPEG (max 2560 px long side, quality 82) → thumbnail JPEG (max 480 px).
- **Rationale**: **prebuilt `sharp` cannot decode iPhone HEIC** (HEVC-coded; the bundled libheif
  is AV1-only for patent reasons), so a separate decoder is needed. `heic-convert` is WASM and
  works on Vercel but is slow and memory heavy; fine for one photo at a time.
- **Alternatives**: convert HEIC in the browser before upload (breaks "server verifies"), build a
  custom `sharp` with HEVC (not possible on Vercel).
- **Risk**: large HEIC files could approach memory limits. Enforce a size cap (**25 MB**, an
  assumption) and test a real iPhone photo early.

## R6. Upload and duplicate detection

- **Decision**: client computes SHA-256 with Web Crypto as an *optimistic* pre-check only
  (`POST /uploads` may answer "duplicate" early). The authoritative hash is computed server-side
  in finalize over the original bytes. Insert uses a partial unique index on
  `(event_id, content_hash) WHERE deleted_at IS NULL` and `INSERT … ON CONFLICT DO NOTHING
  RETURNING`. The loser of a simultaneous race gets the existing row and cleans up its processed
  files. The hash is of the original upload; the processed file is what is stored and shown.
- **Rationale**: a database constraint is the only race-proof dedupe; app-level "select then
  insert" fails for the "same instant" case (SC-004). Hashing the original makes byte-identical
  re-uploads detectable even though processing changes the stored bytes.
- **Note**: a photo hidden by a report still counts as existing, so a reported photo cannot be
  re-uploaded. A photo deleted by its uploader no longer blocks re-upload.

## R7. Upload intents

- **Decision**: `POST /uploads` inserts an `upload_intents` row (event, exactly one uploader,
  temp path, expiry 15 min) and returns the signed URL. Finalize requires an unexpired,
  unfinalized intent owned by the caller, so the server never trusts a client-supplied path.
  Orphaned temp objects (abandoned uploads) are removed by the daily sweep.
- **Rationale**: closes "finalize any object" and "finalize someone else's upload" holes.

## R8. Storage

- **Decision**: private bucket; temp raw uploads under `tmp/`, processed files under
  `events/<eventId>/<mediaId>.jpg` and `…/<mediaId>.thumb.jpg`. Reads use signed URLs valid
  **5 minutes**, minted server-side per gallery request; the gallery client re-requests the list
  (and on image load error) to refresh them. Bucket-level file size limit 25 MB.
- **Rationale**: a private bucket means hidden or removed photos cannot be fetched by old links
  (public URLs from Phase 1 would defeat hide-on-report). The short lifetime bounds how long an
  already-loaded gallery can still fetch a photo after it is reported: at most 5 minutes
  (accepted, plan Open Item 10).
- **R2 note**: only paths are stored; signed-URL minting lives in `lib/storage.ts`, the single
  file to change on migration. No abstraction layer built yet (**FLAG**, item 2).

## R9. Guest verification provider (constitution VI, v3.0.0)

- **Decision**: `VerificationProvider { send(identifier); verify(identifier, code):
  Promise<{ identifier } | null> }` with **exactly two operations**. The channel is configuration
  (`VERIFICATION_CHANNEL`, `email` for now), chosen once in `lib/verification/index.ts`; it is not an
  interface member. Each provider validates and normalizes identifiers of its own channel internally and
  throws typed errors (invalid identifier; rate limited with a retry-after) that routes map to 400 and
  429. `verify` returns the normalized identifier on success. The active implementation is
  **`EmailOtpProvider`**, which generates a 6-digit code, stores `HMAC-SHA256(code,
  VERIFICATION_PEPPER)` with a 10-minute expiry and `attempt_count` in `otp_codes` (max 5 attempts per
  code, single use), applies its own throttles (R10), and emails the code through the existing Mailer
  (Gmail SMTP) with `after()`. The send response is identical every time and **never contains the code**;
  the code is **never logged** (XII). Everything else depends only on this interface and on `guest_id`.
- **`otp_codes` reused**: the original OTP table structure is kept (HMAC-hashed code, expiry,
  `attempt_count`). Only its identifier column is generalized to hold an email address, or a phone
  number if a phone channel is ever active.
- **Guest identity (generic)**: a guest's verified identity is `guests.identifier` (text) + `channel`
  (text, `email` now, `phone` anticipated) + `verified_at`, **UNIQUE `(identifier, channel)`**, replacing
  separate email and phone columns. Lookup and creation at verification is by `(identifier, channel)`.
  This makes constitution VI literally true: a future phone channel adds rows with `channel='phone'`,
  existing email-verified guests are untouched, and no migration is required. There is no phone column
  and no phone is collected (spec FR-053 withdrawn, constitution II). Consent, `event_guests`, media,
  reports, and sessions reference `guest_id`, never the identifier, so none of them change.
- **Where the channel shows up**: only in configuration, the provider registration in
  `lib/verification/index.ts` (which also holds each channel's UI hints, `inputType` and `label`, served
  by the config route), and the `channel` value written by `lib/verification/guest-identity.ts` when it
  finds or creates a guest. Nothing branches on the channel name anywhere else; the identity-deletion
  route only clears the three columns.
- **No dev shortcut and no placeholder**: a session exists only after a real emailed code is
  confirmed; there is no `devCode`. For local manual testing use `MAIL_PROVIDER=gmail` with your own
  inbox; automated tests use an in-memory `memory-mailer`.
- **Why HMAC, not a plain hash**: six digits has only a million possibilities, so an unkeyed hash is
  instantly reversible if the table leaks. A keyed hash plus attempt limits is the reasonable floor.
- **SMS swap path (documented, not built)**: at the code level, implement `SmsOtpProvider` against the
  same interface, register it, and set `VERIFICATION_CHANNEL=sms`. Phone-verified guests are new rows
  with `channel='phone'`; email guests are untouched; sessions, consent, `event_guests`, media, reports,
  and `otp_codes` need no change; **no migration is required**. The channel-swap test proves it against
  the real schema with a second channel. Not decided: the policy for guests already verified by email.
- **Open question (not decided)**: once SMS is live, are existing email-verified guests ever required to
  additionally verify their phone, or do both remain valid indefinitely? Either answer is workable;
  neither is chosen now.
- **Consequences of email** (see R30): capacity, delivery time, disposable inboxes.

## R10. Throttling

- **Verification-code sends** (implemented inside `EmailOtpProvider`, because it owns `otp_codes` and the mail allowance; a vendor-verified provider would use the vendor's limits): split into **new codes** and **resends** so a stranger cannot burn a real
  guest's limit. A send while no valid unused code exists for the identifier is a new code, limited to 5
  per identifier per rolling hour. A send while one exists is a resend, limited to 10 per identifier per
  rolling hour and at least 30 seconds apart, and it does not count against the new-code limit. Because
  codes are stored only hashed they cannot be re-emailed, so a resend issues a fresh code; older unused
  codes stay valid until they expire (at most 3 valid at once, oldest dropped) so a stranger's request
  cannot cancel a real guest's pending code. `otp_codes.is_resend` records which kind each send was.
  **System-wide**: a generous daily cap (400 per rolling day by default, `VERIFICATION_DAILY_CAP`) and
  no short-window system-wide limit, so one reception's worth of guests (for example 300) can verify
  within an hour. The cap leaves about 100 messages a day for safety email under an assumed 500-a-day mail
  allowance (verify the real figure). Alerts and notices are never counted or blocked by it.
  **Residual**: a determined attacker with many fresh sessions can still delay a victim; stopping that
  needs per-source limits, which are not built.
- **Verification-code confirm**: `attempt_count` on each row caps a single code at 5 attempts. To stop
  an attacker requesting fresh codes, confirm also refuses (429) when the **sum of `attempt_count`
  across that identifier's codes created in the last hour reaches 10**.
- **Host login**: `otp_codes` cannot be used (no guest identifier or code involved), so `hosts` carries
  `failed_login_count` and `locked_until`. Five consecutive failures lock the account for 15
  minutes; success resets the count. While locked, every attempt (even with the right password) gets
  the same generic 401 without checking the password, so the response never reveals that the email
  exists. Unknown emails still run a dummy hash to equalize timing.
- **Password reset requests**: at most 3 reset tokens per host per rolling hour, counted from
  `password_reset_tokens`; beyond that the request still returns the uniform response but creates and
  sends nothing (see R17).
- **Reports**: at most 5 reports per guest per event per rolling 15 minutes (see R19).
- **Email verification links**: at most 3 verification tokens per host per rolling hour (see R20).
- **Uploads**: at most 200 upload intents per guest per event per rolling hour (see R21).
- **Counter retention**: `otp_codes` rows are kept for at least 25 hours regardless of expired or used status. The rolling-window counters above count these same rows, so deleting them early would reset the counters. Housekeeping (registered as a sweep step) deletes only rows older than that.
- **Not covered**: byte-volume caps and per-IP limits. Vercel Hobby has no built-in per-user limit and an
  in-memory limiter is unreliable across serverless instances, so none is used.
- **If a vendor-verified channel is added later**, that vendor's own limits apply and the
  `otp_codes` throttles go away for that provider.

## R11. Reporting and evidence retention

- **Decision**: `reason` is `text` with `CHECK (reason IN ('self_removal','inappropriate',
  'harmful','other'))`. Filing runs in one transaction: insert report, set media
  `visibility='hidden'`. Statuses: `open`, `upheld`, `dismissed`, `auto_held`. Harmful evidence =
  `reason='harmful'` and status `upheld` or `auto_held`.
- **Purge order** (in one transaction per event or media): (1) any *open* harmful report on the
  target becomes `auto_held` (fail safe, no review happened); (2) for harmful evidence, set
  `media_id = NULL, event_id = NULL` (the report row stays, keeping `reporter_guest_id` or `reporter_host_id`, `reviewed_by`,
  reason, status and timestamps); (3) delete all other reports on the target; (4) delete media,
  then event. `media_id` and `event_id` are `ON DELETE SET NULL` as a backstop so a missed step
  cannot cascade-delete evidence.
- **Plain foreign keys for people**: `reporter_guest_id` and `uploader_guest_id` reference `guests`;
  `reporter_host_id`, `reviewed_by` and `uploader_host_id` reference `hosts`; all `ON DELETE RESTRICT`. No hashes or
  snapshots. So that a purge cannot be blocked or lose the reference, a guest or host referenced by
  harmful evidence (as reporter, reviewer, or uploader) is **tombstoned, never hard-deleted** (guest:
  phone cleared, name kept; host: email and password hash cleared; both keep `id` and `deleted_at`).
  Consequence: after the person deletes their identity, the evidence row still points to them by
  id, but the personal data that would identify them is gone.
- **Evidence is captured at filing, not at purge**: the report insert copies the media's
  `guest_id`/`host_id` into `uploader_guest_id`/`uploader_host_id` and its `content_hash` into
  `reports.content_hash`, in the same transaction that hides the photo. This means the uploader and
  hash exist for every report from the start, and nothing has to be reconstructed after the media is
  gone (spec FR-031). The hash also lets a later feature refuse a re-upload of known-harmful content.
- **Auto-resolve** applies to every open report after 72 hours regardless of reason; only evidence
  retention is scoped to harmful reports.
- **Spec note**: the spec's reason list was illustrative; this plan uses the brief's four values.

## R12. Daily sweep

- **Decision**: `GET /api/cron/sweep` (Vercel cron, once a day), requires
  `Authorization: Bearer $CRON_SECRET`, constant-time compare, safe to re-run (each step is
  idempotent). Steps: (1) auto-hold **every** open report older than 72 hours and email each
  affected host a digest; (2) retry unsent harmful alerts and unsent auto-hold notices; (3) purge
  media past `purge_after` or upheld; (4) purge events and hosts past `purge_after`; (5) delete
  orphaned temp and unreferenced processed uploads, expired sessions, verification-code rows, and expired or used
  password-reset tokens.
- **Timing note**: with a 72 h window and a daily job, an unreviewed report resolves between 72
  and 96 h after filing. The photo has been hidden the whole time, so the fail-safe holds.
- **Rationale**: only sweeps that must run without a user request live here; nothing else is
  queued (constitution V).

## R13. Notifications by email

- **Decision**: a `Mailer` interface (`send(to, subject, text)`) behind `lib/notify/index.ts`, same
  swap-by-config idea as `VerificationProvider`. Emails in this feature (the guest verification code is described in R9 and R30):
  1. **Harmful alert**: sent immediately when a `harmful` report is filed, to the event's owner
     host and to the operator (`OPERATOR_EMAIL`). Sent with `after()`, after the hide transaction
     has committed and the response is on its way, so neither a mail failure nor a slow SMTP
     connection can undo the hide or hang the reporting guest's request. `reports.alerted_at` is set on success;
     the daily sweep retries harmful reports whose `alerted_at` is still null.
  2. **Auto-hold notice**: one digest email per host per sweep listing the reports auto-resolved
     to hidden; `reports.auto_hold_notified_at` is set on success and unsent ones retry next sweep.
- **Content rule**: emails contain the event name, reason, time and a dashboard link only. No phone
  numbers, no tokens, no image URLs (constitution XII).
- **Same pattern later**: wrap-up and close-prompt emails can reuse the `Mailer`, but are not in
  this spec.
- **Password reset (FR-038)** uses the same mailer. The email carries a single-use reset link; the
  link is a secret, so the mailer never logs message bodies.
- **Real implementation: Gmail SMTP via `nodemailer`.** Host `smtp.gmail.com`, port 465 (TLS),
  authenticated with the operator's Gmail address and an **app password** (requires 2-Step
  Verification on the Google account); no OAuth. Selected with `MAIL_PROVIDER=gmail`; credentials in
  `GMAIL_USER` and `GMAIL_APP_PASSWORD`; `MAIL_FROM` is the sender name/address (Gmail rewrites the
  address to the authenticated account unless an alias is configured). The transport is created per
  call with short timeouts (connect about 10 s, socket about 15 s) and closed after sending, which
  suits serverless; because every email is sent via `after()`, a slow connection never holds up a response.
- **Why Gmail SMTP now**: no domain exists yet. Resend's unverified-domain sender only reaches the
  account owner, whereas Gmail SMTP delivers to any real recipient today. Volume was assumed to be a handful of
  emails per event, well inside Gmail's daily limit.
- **Swap later**: moving to Resend once a domain exists is a config change (`MAIL_PROVIDER=resend`
  plus a new implementation file), made for deliverability, not because Gmail stops working. Nothing
  outside `lib/notify/index.ts` names a vendor.
- **Fail closed**: `lib/notify/index.ts` throws if `MAIL_PROVIDER=console` in production (alerts
  must never silently vanish) or if `MAIL_PROVIDER=gmail` is missing a credential.
- **Risk**: the operator's Gmail account is a single dependency for alerts, resets and auto-hold
  notices. See plan Open Item 1.

## R14. Validation

- **Decision**: hand-written validators in `lib/validate.ts` (email shape and length, the guest identifier via the active provider,
  password length, UUIDs, enum membership, string length caps), called at the top of every route.
  Unknown body fields are ignored, never passed to SQL. All SQL is parameterized.

## R15. Logging

- **Decision**: application code logs through `lib/log.ts`, which drops known-sensitive keys
  (`identifier`, `email`, `phone`, `code`, `token`, `password`, `newPassword`) and never receives request bodies from auth routes. No
  raw `console.log(body)` anywhere. Error responses on auth routes are generic.

## R16. Migration from Phase 1

- **Decision**: migration `003` first **truncates the existing `events` and `photos` tables**
  (Phase 1 data is disposable), then drops `photos` and `events.pin` and creates the new schema
  (new `events.access_token` is NOT NULL, so no old rows may remain). Phase 1 files already in the
  Storage bucket under `events/` are not removed by the migration; delete them by hand.

## R17. Host password reset (spec FR-038)

- **Decision**: `POST /api/auth/host/password-reset/request` then `.../confirm`. Request always
  returns the same `202` body. For an existing, non-deleted host it creates a
  `password_reset_tokens` row (32 random bytes, only the SHA-256 stored, 30-minute expiry, older
  unused tokens invalidated) and emails `APP_BASE_URL/reset-password#token=…` through the mailer.
- **No enumeration**: the response is identical for unknown emails and for throttled requests. To keep
  response *timing* from revealing whether an account exists, the email is sent after the response
  using Next.js `after()` (post-response work inside the same request, not a queue or background job,
  so constitution V is not engaged). If a maintainer reads V more strictly, the fallback is to accept
  a small timing difference.
- **Token in the URL fragment**: a fragment is never sent to the server or written to request logs, so
  the reset token cannot leak into Vercel logs (constitution XII in spirit). The reset page reads it
  and posts it in the `confirm` body.
- **On confirm**: validate token (unexpired, unused, host active), enforce password rules, store the
  new bcrypt hash, mark the token used, delete all `host_sessions` for the host, clear
  `failed_login_count` and `locked_until`. It does not log the host in; they sign in with the new
  password.
- **Throttle**: at most 3 tokens per host per rolling hour (R10).
- **Not covered**: verifying that an email address is genuine at signup (spec says so explicitly).

## R18. Closing an event (spec FR-036)

- **Decision**: `events.closed_at` (null = open). Toggled by the owner through `PATCH
  /api/host/events/:eventId` with `{closed: true|false}`; reopening is allowed.
- **Where it is enforced**: when an upload intent is requested and again in finalize, so an upload
  started before the close is refused and its temp object removed. `409 {code:'event_closed'}`.
- **Unaffected**: viewing, reporting, review, deletion, and the daily sweep. The gallery shows a
  closed banner and hides the upload control; the server check is the real gate.
- **Why not a status enum**: one nullable timestamp is enough for open/closed and records when. A
  richer lifecycle (archived, retention) is a separate, later decision.

## R19. Per-guest report limit (spec FR-037)

- **Decision**: at most **5 reports per guest per event per rolling 15 minutes**, counted from
  `reports` where `reporter_guest_id` and `event_id` match, over **all** statuses (a dismissed report still
  counts, so dismissals cannot reset the limit). Beyond it: `429 {code:'report_limit'}` with
  `Retry-After`; existing reports and their hidden photos stay in force.
- **Race safety**: the count and the insert run in one transaction guarded by
  `pg_advisory_xact_lock(hashtext(reporter_guest_id || event_id))`, so two simultaneous requests cannot both
  pass the check.
- **Index**: `(reporter_guest_id, event_id, created_at)`.
- **Media row lock**: the transaction begins with `SELECT … FOR UPDATE` on the media row, so a
  simultaneous uploader or owning-host deletion either finishes first (and the report is rejected as
  deleted media) or waits until the report commits. This closes the report-versus-delete race.
- **Known limit**: this stops rapid mass-hiding, not a patient guest who files five every 15 minutes.
  A cap on a guest's total *open* reports per event would close that; it is deferred as a cheap later
  addition (two-way door), and the host sees all reports in the dashboard meanwhile. The limit does not
  apply to hosts.

## R20. Host email verification (spec FR-040, FR-041)

- **Decision**: non-blocking. `hosts.email_verified_at` (null = unverified) and an
  `email_verification_tokens` table shaped like the reset tokens (32 random bytes, only the SHA-256
  stored, single use, **7-day** expiry since a host may not open the email at once). Signup creates
  a token and emails `APP_BASE_URL/verify-email#token=…` with `after()`, so signup is fast and never
  fails because of email. `POST …/email-verification/resend` (host) issues a new token, invalidating
  older ones, limited to 3 per host per hour; `…/confirm` (no login needed) verifies.
- **Nothing is gated**: no guard, route, or query reads `email_verified_at` except the dashboard
  reminder (`GET /api/host/me`). Unverified hosts still receive alerts, digests, and reset links at
  the address on file.
- **Token in the fragment**, like the reset link, so it never reaches request logs.
- **Password reset also verifies**: completing a reset proves control of the inbox, so it sets
  `email_verified_at` when null. No extra step for the host.
- **Why it is not the safety net**: harmful-report alerts go to the operator regardless (R13), so an
  unverified or mistyped host email never leaves a harmful report unseen. Verification only makes
  host-specific alerts and reset links trustworthy. A typo'd email means the host never gets the
  message and the reminder stays; that is accepted.
- **Not covered**: changing a host's email (no such feature in this spec).

## R21. Per-guest upload limit (spec FR-042)

- **Decision**: at most **200 upload intents per guest per event per rolling hour**, counted from
  `upload_intents` where `guest_id` and `event_id` match and `created_at` is within the last hour,
  finalized or not. Beyond it: `429 {code:'upload_limit'}` with `Retry-After`; earlier photos are
  unaffected. Hosts are exempt.
- **Why 200**: a full camera roll after an event is normal, often 50 to 150 photos, and can be a
  few hundred for a very active guest. 200 per hour is more than 30 times the report limit's hourly
  pace and does not interrupt a normal sitting, yet caps a single guest at roughly 200 x 25 MB = 5 GB
  of attempts per hour, which is the abuse case (storage and processing cost).
- **Why count intents, not finalized uploads**: signed upload URLs let a client place raw files in
  storage without ever finalizing, so counting only successes would miss the cheapest abuse.
- **No advisory lock**: unlike the report limit, this is a generous cost guard, so a small overshoot
  from simultaneous requests is acceptable. Early duplicate answers (hash already in the event) create
  no intent and do not count.
- **Client behavior**: the upload UI uploads with a small concurrency (about 3) and shows the
  `Retry-After` time if it hits the limit; nothing is retried automatically past it.
- **Known gap**: a per-guest byte-volume cap is not built; the 25 MB per-file cap and this count
  together bound the exposure for now. Two-way door if it proves too loose.

## R22. Gallery features rebuilt (spec US8, FR-043 to FR-047)

- **What Phase 1 had** (read from app/e/[eventId]/gallery/page.tsx): a full-size viewer with prev/next
  and swipe, a per-photo download, a photo count, and a share button. They are ported, not redesigned.
  Because the current page has uncommitted edits, T013 first commits or copies it.
- **Download**: `GET /api/e/:token/media/:mediaId/download` returns a `302` to a 5-minute signed URL
  created with the storage download option (so the browser saves rather than displays). Never a public
  URL, `no-store`, only for visible non-deleted media in that event. The file is already
  metadata-stripped (FR-017).
- **Count**: computed server-side as visible, non-deleted photos and returned by `GET /api/e/:token`,
  so it always matches what a viewer can see (SC-018).
- **Viewer**: one client component with slots for the report control (US5) and the owning host's
  delete control (US7). It handles the current photo disappearing when the list refreshes (for
  example hidden by a report) by moving to a valid photo or closing.
- **Share**: Web Share API when present, copy-link fallback. The link is the event's current
  `APP_BASE_URL/e/<accessToken>`.
- **QR**: lives on the host dashboard beside the link (`GET /api/host/events/:eventId/qr`, guarded by
  `requireEventHost`), generated from the current token with the existing `lib/qr.ts`. The guest
  gallery shows no QR, since a guest already has the link.

## R23. Host removal of any photo, optionally harmful (spec FR-048, FR-049)

- **Decision**: `DELETE /api/media/:mediaId` accepts the owning host. In one transaction that locks
  the media row: mark it deleted (short `purge_after`), close any open reports on it as `upheld` with
  `reviewed_by` set, and, only when `{harmful:true}`, insert one evidence report directly as `upheld`
  with `reason = 'harmful'`, `reporter_host_id` and `reviewed_by` both the host, and the uploader and
  content hash copied from the media.
- **Why a real report row**: purge and evidence retention already key off "harmful and upheld", so a
  host-marked removal reuses that path unchanged; nothing new is needed at purge time.
- **Schema consequence**: the report's reporter can now be a host, so `reporter_id` became
  `reporter_guest_id` plus `reporter_host_id` with exactly one set, mirroring the uploader columns.
- **No email**: the host is the actor, so no alert goes to the host or the operator. An unmarked
  removal keeps no evidence (the host can mark harmful, or not, deliberately).
- **Not gated by the guest report limit**: hosts are exempt, and a host-marked row is never `open`.
- **Open guest reports on the photo** close as `upheld`, so a harmful guest report on it still becomes
  evidence and a non-harmful one is removed with the event, as usual.

## R24. All emails through `after()` (supersedes the mixed sync/`after()` approach)

- **Decision**: every email (guest verification code, host signup verification, password reset, harmful alert, auto-hold digest, and
  the sweep-failure alert) is sent through Next.js `after()`, never awaited in the response path.
  Routes that send email set `export const maxDuration = 60` so the post-response work can finish
  (the mailer's own timeouts are about 10 s connect and 15 s socket).
- **Why this is safe**: the property that matters, the photo being hidden immediately, is guaranteed
  inside the report's own database transaction and does not depend on email at all.
- **Durability**: not from blocking the response. It comes from the existing `alerted_at` and
  `auto_hold_notified_at` columns: the daily sweep retries any harmful alert or auto-hold digest that
  is still unsent. Verification and reset emails have no retry; the host can request a new link.
- **Benefit**: a slow SMTP connection can no longer hang a guest's report request (the earlier
  synchronous design could hold it for up to about 25 s).
- **Constitution V reading**: `after()` is post-response work inside the same request, not a queue or a
  background job. If that reading is ever rejected, the fallback is inline sending with short
  timeouts. Recorded in the plan's constitution check.

## R25. (withdrawn)

Removed with the placeholder provider: there is no dev OTP shortcut, so no related gate or
environment-isolation requirement exists. Kept only so later section numbers stay stable.

## R26. Schema: cascade only where it is a plain join

- **`event_hosts.event_id` cascades** (`ON DELETE CASCADE`). It is a plain join table; nothing should
  block deleting an event on account of it.
- **`media` does not cascade from `events`, on purpose.** The purge must run in the app's control:
  detach harmful evidence first, delete media explicitly, then delete the event. A cascade would let
  the database remove media before evidence could be detached. The migration and data model both say
  "do not add a cascade to media" so it is not "fixed" the way `event_hosts` was.
- **`reports` links** keep `SET NULL` on `media_id` and `event_id` and `RESTRICT` on people, as before.

## R27. Actor precedence at an owned event

- At an event the caller owns as host, `resolveEventActor(event)` always returns the host, even when
  the same person also holds a guest session (for example from testing). At any other event, the caller
  is a guest if they hold a guest session. This keeps "exactly one uploader" deterministic (FR-014) and
  is covered by an integration test.

## R28. Sweep failure alert and release-blocking tests

- **Sweep failure**: each sweep step runs in its own try/catch so one failure does not stop the others.
  If any step throws, the operator is emailed (through `after()`) the failed step name, the time, and an
  error class, with no personal data, and the route returns `500` so Vercel records the failure. This
  covers the sweep failing, not only the sweep finding something stale. A sweep that never runs at all
  (cron not firing) is not detected; that gap is noted, not solved.
- **Release-blocking automated tests**: `purge-evidence` (harmful evidence keeps reporter or host
  reporter, reviewer, uploader, and `content_hash`; non-harmful reports are deleted; referenced people
  are tombstoned; works without a media cascade) and `tenant-isolation` (host A cannot touch host B's
  events, media, reports, or QR; foreign ids return 404). They need a local Postgres and are part of the
  release gate alongside the manual quickstart.

## R29. Accepted tradeoff: signup reveals registered emails

- Signup returns `409` for an already-registered email. This reveals registered addresses, unlike login
  and reset, which do not. It is accepted as a standard signup-usability tradeoff, not a defect to fix.

## R30. Guest verification by email: capacity, delivery, abuse

- **Capacity (the big consequence)**: every guest verification sends one email. A 200-guest event
  sends about 200, not "a handful". Consumer Gmail SMTP allows roughly 500 messages a day (verify the
  current figure), shared with harmful alerts, digests, reset and verification links for hosts, and
  sweep-failure alerts. So Gmail SMTP is the platform's throughput ceiling at about one large event a
  day. Mitigation built in: a **generous daily verification-email cap** (400 by default, configurable,
  no tight hourly limit) so one reception can verify in a short window while about 100 messages a day
  stay available for safety email; safety emails are never counted against it. A second large event on
  the same day, or a larger one, will hit the cap: moving to a transactional provider on a verified
  domain (Resend) is now also a capacity upgrade, worth doing before real events at scale, and raising
  `VERIFICATION_DAILY_CAP` is a config change.
- **Delivery time**: SC-003 (verify and upload in under 2 minutes) now depends on the code email
  arriving quickly. Mail from a personal Gmail address to first-time recipients can land in spam or be
  delayed. Measured in quickstart scenario 29 with real, never-used inboxes.
- **Abuse**: anyone can request a code for any address, so an address can be spammed. Per-identifier
  limits (5 per hour) and the system-wide cap bound this; a per-IP limit is not built (no reliable
  serverless limiter, per R10). The send response never reveals whether an address is known.
- **Disposable inboxes**: email proves control of an inbox, not one real person, and one person can
  create many identities. Per-guest limits (5 reports and 200 uploads per event) are therefore weaker
  than they would be under phone. Accepted; a per-event aggregate limit is a possible later addition.
- **Console mailer and logging**: the console mailer prints only the template name, never the recipient
  or body, because a guest's email address is an identifier under constitution XII. Tests use an
  in-memory mailer.
- **Hosts unchanged**: hosts keep email + password; a person who is both uses two separate identities
  even if the address is the same.

## R31. (withdrawn)

The optional self-reported phone number (FR-053) was removed: collecting a number for a channel that
does not exist yet breaks constitution II (no building ahead of proven need). Revisit only once SMS is
actually chosen. Kept only so section numbers stay stable.

## R32. Mail capacity rehearsal (release gate)

- **Why**: guest verification sends about one email per guest, so the Gmail SMTP account's real daily
  throughput, delivery time, and spam behaviour decide whether a real event works. The roughly
  500-a-day figure is from memory and may be lower for an automated account; it must be measured.
- **What**: before the first real event, with `EXPECTED_PEAK_GUESTS` set, send a realistic batch of
  verification emails through the Gmail account to inboxes you control (several addresses and
  providers, never third parties), spread like a real reception, plus a few harmful-alert and digest
  emails. Record messages delivered, any Gmail throttling or daily-limit errors, spam placement, median
  delivery time, and the number the account actually sends in a day.
- **Pass**: it covers the expected peak with at least 20% headroom plus an alert reserve, with no
  throttling errors. **Fail**: move to a verified-domain transactional provider (for example Resend) as a
  new `Mailer` implementation behind `MAIL_PROVIDER`, before the event. That makes the swap a release
  gate, not a later upgrade.

## R33. Duplicate match against a hidden photo, and owner-host mode

- **Duplicate answer**: when an upload matches an existing photo in the event, the response is
  `{duplicate:true}`; `mediaId` is included only when the matching photo is visible. A match against a
  hidden (reported) photo returns `{duplicate:true}` with no media id, so a guest cannot learn the id of
  hidden content. Applies to both the early answer at upload request and the finalize answer.
- **Owner-host mode**: `GET /api/e/:token` returns `isOwnerHost` (true only for a valid host session
  that owns the event, via `resolveEventActor`). The gallery then shows the host's controls and an upload
  control that acts as the host, with no verification, consent, or name prompts; the server still
  enforces ownership on every call.
