# Implementation Plan: Identity, Trust & Media Handling

**Branch**: `002-identity-trust-media` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-identity-trust-media/spec.md`

## Summary

Replace Phase 1's PIN/anonymous model with real identity: hosts (email + bcrypt password, with
email-based password reset and non-blocking email verification) own many events and can close them to stop new uploads; guests verify
their email once through a channel-agnostic `VerificationProvider` (email today, phone/SMS later by configuration) and stay recognized across events; every photo has
exactly one verified uploader. Uploads go browser → private
Supabase Storage via signed URL, then a synchronous finalize step re-reads the file, computes the
authoritative SHA-256, strips metadata, converts HEIC, makes a thumbnail, and stores only the
processed result. A guest report hides its photo immediately (capped at 5 per guest per event per 15 minutes) and
records the uploader and file hash; a `harmful` report also emails the host and the operator at once. The owning host can also delete any photo directly and optionally mark it harmful, which records the same evidence. The gallery keeps Phase 1's viewer, per-photo download (signed link), count and share. Hosts review from a dashboard; a single daily cron sweep
auto-resolves every report still unreviewed after 72 hours (within 96, since it runs daily), and purges soft-deleted data,
detaching harmful report evidence so it survives. Everything stays inside the one Next.js app on
Vercel with raw SQL via `pg`.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (App Router), React 19, Node.js runtime on Vercel

**Primary Dependencies**: existing `next`, `pg`, `@supabase/supabase-js` (Storage only), Tailwind,
shadcn/ui. New: `bcryptjs` (pure-JS bcrypt, avoids native-build issues on Vercel), `sharp`
(resize, EXIF strip, JPEG encode), `heic-convert` (HEIC/HEIF decode; see research R5),
`nodemailer` (Gmail SMTP mailer; see research R13)

**Storage**: Supabase Postgres (raw SQL, Data API disabled); Supabase Storage private bucket,
signed read URLs valid **5 minutes**; only paths are stored, never full URLs, so a later move to
Cloudflare R2 leaves the schema untouched

**Email**: a small `Mailer` interface (`send(to, subject, text)`), sent through Next.js `after()` from
request handlers and the daily sweep (never awaited in the response path). Used for the harmful-report alert, the auto-hold notice, and
the host password-reset link (FR-038); available to later wrap-up/close-prompt emails, which are
outside this spec. The real implementation is **Gmail SMTP via `nodemailer`** with an app password
(not OAuth), selected by `MAIL_PROVIDER=gmail`. No domain is needed and it reaches any recipient.
A `console` implementation exists for local development and tests only. A later swap to Resend
(for deliverability once a domain exists) is a config change behind the same interface

**Testing**: Manual quickstart scenarios ([quickstart.md](./quickstart.md)) plus automated tests with
`node --test` (and a TypeScript runner) against a local Postgres with migration 003 applied. Pure-logic
unit tests cover token hashing, verification-code and throttle logic, login lockout, and reset and
verification tokens. Integration tests cover the dedupe and report-limit races, actor precedence, sweep
failure, the channel swap against a real second channel, and two **release-blocking** suites: purge and
evidence retention, and tenant isolation. No new framework

**Target Platform**: Web, mobile-first browsers for guests; desktop or mobile for hosts

**Project Type**: Single Next.js web application (frontend + API routes together)

**Performance Goals**: guest verify + first upload < 2 min (SC-003); report hides photo < 2 s
(SC-007); harmful alert email sent within 1 minute (SC-009); password reset completable in under
5 minutes (SC-013); finalize well under the function limit for one photo

**Constraints**: Vercel Hobby function limit 300 s (finalize set to `maxDuration = 60`); Hobby
cron runs at most once per day; no queue beyond the daily sweep; signed upload URL bypasses the
request-body limit; never log guest identifiers (email addresses or phone numbers), verification codes, or session tokens

**Scale/Scope**: a handful of hosts and events, hundreds of guests, photos per event in the low
hundreds. No scale work beyond correctness

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Evaluated against
constitution v3.0.0.

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-tenant | PASS | Every event, media, and report query is scoped through `requireEventHost` / `resolveEventByToken`. |
| II | Build only for observed need | PASS | Additions beyond the brief: `upload_intents` (finalize must trust a temp path) and two lockout columns on `hosts`. No caching, no storage abstraction. |
| III | One app | PASS | All logic in Next.js routes; cron is a route in the same app. |
| IV | Raw SQL, Data API off | PASS | `pg` only. `supabase-js` is used for Storage calls only. |
| V | No queue beyond daily cron | PASS with note | One `/api/cron/sweep`. Image processing is synchronous. Every email is sent through Next.js `after()` (post-response work inside the same request, not a queue or job), so a slow SMTP connection never hangs a request and reset timing does not reveal an account. Email durability comes from the `alerted_at` and `auto_hold_notified_at` retry on the next sweep, not from blocking the response (research R24). If V is read more strictly, the fallback is inline sending with short timeouts. |
| VI | Real identity, channel-agnostic verification | PASS | `VerificationProvider` with exactly two operations (`send(identifier)`, `verify(identifier, code)`); the channel is configuration (`email` now); each provider owns validating its identifiers and, for the email provider, its throttles. Guests are rows keyed by `(identifier, channel)` and everything else keys off `guest_id`, so a phone channel is one new provider plus configuration, with no migration. No placeholder and no dev shortcut: a session exists only after a real emailed code is confirmed. |
| VII | Hashed server-side sessions | PASS | `host_sessions` / `guest_sessions`, SHA-256 of a 32-byte random token, no JWT. |
| VIII | Server-side validation | PASS | A shared `lib/validate.ts` used by every route. |
| IX | Host hands-off | PASS with flag | Only `harmful` reports interrupt, by immediate email to the host and the operator. Delivery is real via Gmail SMTP; see Open Item 1 for its limits. |
| X | Report hides immediately | PASS | Report insert and `media.visibility = 'hidden'` happen in one transaction, before any email is attempted. |
| XI | Harmful evidence survives | PASS | Detach-not-delete with plain foreign keys; see [data-model.md](./data-model.md). |
| XII | Never log secrets | PASS | Enforced by a `lib/log.ts` redaction wrapper; email bodies carry no guest identifiers beyond the recipient, and no tokens or codes are ever logged. |
| — | Out of scope: co-hosts | PASS | `event_hosts` is a deliberate design: one `owner` row per event today, schema ready for co-hosts later. No co-host invite, listing, or permission UI is built. |

**Post-design re-check**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-identity-trust-media/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── auth/
│   │   ├── host/{signup,login,logout}/route.ts
│   │   ├── host/password-reset/{request,confirm}/route.ts
│   │   ├── host/email-verification/{resend,confirm}/route.ts
│   ├── host/me/route.ts                          # email and verified state for the reminder
│   │   └── guest/{verification/config,verification/send,verification/confirm,logout,delete}/route.ts
│   ├── host/events/route.ts                      # list/create own events
│   ├── guest/me/route.ts                         # optional display name
│   ├── host/events/[eventId]/route.ts            # rename, close/reopen, soft-delete, rotate token
│   ├── host/events/[eventId]/restore/route.ts
│   ├── host/events/[eventId]/qr/route.ts        # QR of the event's current link
│   ├── host/events/[eventId]/reports/route.ts    # dashboard list
│   ├── host/reports/[reportId]/route.ts          # uphold / dismiss
│   ├── host/account/route.ts                     # soft-delete account
│   ├── e/[token]/route.ts                        # event metadata + visible media
│   ├── e/[token]/consent/route.ts
│   ├── e/[token]/media/[mediaId]/download/route.ts   # 302 to a 5-minute signed download URL
│   ├── e/[token]/uploads/route.ts                # request signed URL
│   ├── e/[token]/uploads/[intentId]/finalize/route.ts
│   ├── media/[mediaId]/route.ts                  # uploader or owning host deletes
│   ├── media/[mediaId]/report/route.ts
│   └── cron/sweep/route.ts
├── (host)/…                                      # host pages
└── e/[token]/…                                   # guest gallery, upload, verify pages
lib/
├── db.ts                  # existing pool
├── queries/{hosts.ts,events.ts,reset-tokens.ts,verification-tokens.ts}
├── auth/{host.ts,guest.ts,password.ts,password-reset.ts,email-verification.ts,tokens.ts,guards.ts,errors.ts}
├── verification/{provider.ts,email-otp-provider.ts,email-throttle.ts,guest-identity.ts,index.ts}
├── notify/{mailer.ts,gmail-mailer.ts,console-mailer.ts,memory-mailer.ts,templates.ts,index.ts}
├── media/{sniff.ts,process.ts,finalize.ts,paths.ts,limit.ts}
├── reports/{alert.ts,limit.ts}
├── cron/{auto-hold.ts,purge.ts,housekeeping.ts}
├── storage.ts             # existing, extended for private bucket + signed reads
├── consent.ts
├── validate.ts
└── log.ts
components/gallery/{Lightbox.tsx,ShareButton.tsx}
tests/{unit,integration}/
db/migrations/003_identity_trust_media.sql
```

**Structure Decision**: single Next.js project, extending the existing `app/`, `lib/`, and
`db/migrations/` layout. New query modules live in `lib/queries/` so `@/lib/db` stays a plain file.
The old PIN routes, pages, and `lib/session.ts` are removed early (the `[eventId]` segment would
clash with `[token]`).

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| `upload_intents` table | Finalize must prove a temp file was issued to this uploader for this event | Trusting a client-supplied path would let anyone finalize any object. |
| `failed_login_count` and `locked_until` on `hosts` | Host login has no verification-code row, so `otp_codes.attempt_count` cannot throttle it | A separate throttle table adds more moving parts for the same two facts. |
| `email_verification_tokens` table and `hosts.email_verified_at` | FR-040 needs single-use, expiring confirmation links and a verified flag for the reminder | Reusing the reset-token table with a purpose column saves one table but couples two rules with different lifetimes (7 days vs 30 minutes); a second small table is simpler. |
| `reporter_host_id` on `reports` (with `reporter_guest_id`, exactly one set) | FR-049: a host-marked harmful removal is evidence with the host as reporter | Reusing `reporter_guest_id` for hosts would break its foreign key to guests; a separate evidence table would duplicate the purge logic. |
| `guests.identifier` + `channel` + `verified_at` (UNIQUE `(identifier, channel)`) and the generalized `otp_codes.identifier` (plus `is_resend`) | Constitution VI and FR-051: the channel is configurable, only `VerificationProvider` knows it, and a new channel must need no migration (new rows with `channel='phone'`, existing email guests untouched); FR-008: resends must not burn the new-code limit | Separate `email` and `phone` columns would force a migration and a per-channel code path to add SMS; a plain boolean on `otp_codes` is simpler than a second table for resends. |
| `password_reset_tokens` table | FR-038 needs single-use, expiring, revocable reset links | Signed stateless links cannot be made single-use or revoked. |
| `uploader_guest_id`, `uploader_host_id`, `content_hash` on `reports` | FR-031: evidence must name the uploader and hash after the media is purged | Reading them from `media` at purge time is too late; the row is gone. |
| `events.closed_at` | FR-036 needs an open/closed state | A separate status table or enum is more than one nullable timestamp needs. |
| `alerted_at` and `auto_hold_notified_at` on `reports` | Lets the sweep retry a failed email instead of silently losing the alert | Fire-and-forget email would drop the harmful alert on any transient failure. |

## Notes and Open Items

1. **Mail: decided, with known limits.** Gmail SMTP via `nodemailer` and an app password is the real
   mailer now. **Volume is no longer "a handful per event"**: every guest verification sends an email, so a 200-guest event sends roughly 200. Things to keep in mind:
   - Consumer Gmail has a daily sending cap (roughly 500 messages; verify current figure). It is now
     the platform's throughput ceiling: about two busy events a day, and it is shared with safety
     alerts. FR-052 and a generous daily verification-email cap (400 per day by default, configurable, no
     tight hourly limit so one reception can verify together) leave room for safety alerts. Moving to a transactional provider on a verified domain
     (Resend) becomes a capacity upgrade as well as a deliverability one, and is worth doing before
     real events at scale.
   - Mail is sent as the authenticated Gmail account, so the "From" is that address. Messages from a
     personal address may land in spam for some recipients until a domain and Resend exist. Swap then
     is a config change, for deliverability only.
   - The operator's Gmail account becomes a dependency: an app password requires 2-Step Verification,
     and changing the Google password or a Google security block stops all alerts and reset links.
     Failed sends are retried by the daily sweep (`alerted_at`), but a dead credential needs a human.
   - The app password is a secret: env var only, never logged, never in the repo (constitution XII).
   Still needed: `OPERATOR_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`. A mail capacity rehearsal
   (T077, quickstart scenario 32) must pass before the first real event; failing it makes a
   verified-domain provider a release gate.
2. **Rate limiting beyond what is tasked**: host login lockout (5 failures, 15 minutes), verification-code send
   (new codes 5 per identifier per hour, resends 10 per identifier per hour and 30 seconds apart without counting against the new-code limit, plus a generous system-wide daily cap of 400), verification-code confirm (per-code 5, and a per-identifier cap across codes), password-reset requests
   (3 per host per hour), verification-link requests (3 per host per hour), reports (5 per guest
   per event per 15 minutes), and uploads (200 upload intents per guest per event per hour) are
   tasked. A cap on total open reports per guest per event and a per-guest byte-volume cap are
   deferred (research R19, R21).
3. **Storage abstraction for the R2 move**: not built. `lib/storage.ts` stays a thin module.
4. **Backups**: ownership and location undecided. Purge is irreversible.
5. **Host email verification is non-blocking** (FR-040, FR-041, research R20): nothing is gated on
   it. A mistyped host email means that host never gets alerts or reset links and the dashboard
   reminder stays, but harmful-report alerts still reach the operator, so nothing is missed. Needs
   `APP_BASE_URL` set so emailed links point at the real site.
6. **Verification channel is email** (constitution VI v3.0.0): a guest verifies with a 6-digit code
   emailed through the Mailer. Consequences, none blocking: first-time recipients may find the code
   in spam, so SC-003's 2 minutes depends on delivery time (measured in quickstart scenario 29);
   email proves control of an inbox, not one real person, and disposable inboxes can create many
   guest identities, so per-guest limits (5 reports, 200 uploads) are weaker than under phone; and
   and how email-verified guests are treated once an SMS channel exists is not decided (open item 11).
7. **Guest session lifetime**: proposed 180 days; "once, ever" is per device until a session is lost.
8. **HEIC decoding**: prebuilt `sharp` cannot decode iPhone HEIC (HEVC); see research R5.
9. **Wrap-up and close-prompt emails** are referenced as an existing pattern but are not in this
   spec and are not tasked. The `Mailer` can serve them later.
10. **Residual visibility window**: a photo loaded into an open gallery before it was reported can
    still be fetched by its signed URL for up to 5 minutes. Accepted and documented.

11. **SMS transition policy (not decided)**: once an SMS channel is live, are existing email-verified
    guests ever required to additionally verify their phone, or do both stay valid indefinitely? A
    person who verifies on a second channel is a separate guest identity until a linking policy is
    decided. Either answer is workable; neither is chosen. No migration is needed to add the channel.

## SMS swap path (documented, not built)

At the code level: implement `SmsOtpProvider` against the same `VerificationProvider` interface
(`send(identifier)`, `verify(identifier, code)`), register it, and set `VERIFICATION_CHANNEL=sms`. Guests
verified by phone are new rows with `channel = 'phone'`; existing email-verified guests are untouched;
`otp_codes.identifier` already holds a phone; consent, `event_guests`, media, reports, sessions, and the
throttles are untouched because they key off `guest_id`. No migration is required. The channel-swap
test (T071) proves this against the real schema with a second channel. Not decided: the policy for
guests already verified by email, and whether one person's two identities are ever linked (open item 11).

## Release gates

1. The automated **purge/evidence** and **tenant-isolation** integration tests pass (research R28).
2. The timed quickstart checks for SC-003, SC-007, and SC-009 are met (quickstart scenario 29).
3. Email is verified end to end against real inboxes with `MAIL_PROVIDER=gmail`.
4. **The mail capacity rehearsal passes before the first real event** (tasks T077, quickstart scenario
   32): a realistic batch of verification and alert emails through the Gmail account must cover the
   expected peak guest count with headroom and an alert reserve. If it cannot, moving to a
   verified-domain provider (for example Resend) becomes a release gate, not a later upgrade.

## Accepted tradeoffs

- Signup returns a conflict for an already-registered email, revealing registered addresses. Login and
  reset do not. Accepted deliberately for signup usability (research R29).
- A sweep that never runs at all is not detected; only a sweep that runs and fails alerts the operator.
