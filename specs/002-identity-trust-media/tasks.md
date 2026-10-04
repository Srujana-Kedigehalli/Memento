---

description: "Task list for Identity, Trust & Media Handling"
---

# Tasks: Identity, Trust & Media Handling

**Input**: Design documents from `/specs/002-identity-trust-media/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: The spec does not request tests, but the plan makes two integration suites release-blocking (T071: purge/evidence and tenant isolation). Everything else is validated by the manual [quickstart.md](./quickstart.md) scenarios plus the smaller suites in T071.

**Organization**: Tasks are grouped by user story. Paths follow the single Next.js project layout in plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1 to US8)
- Constitution reminders that apply to every task: raw SQL via `pg` only (IV), server-side validation of every input using `lib/validate.ts` (VIII), no logging of guest email addresses, verification codes, tokens, passwords, reset links, or the Gmail app password (XII), guards from `lib/auth/guards.ts` are the only way routes learn identity (I)

## Decided (no longer flagged)

- `event_hosts` is intentional: one `owner` row per event now, schema ready for co-hosts later. No co-host UI or API is tasked.
- Auto-resolve applies to every unreviewed report at 72 hours; only evidence retention is harmful-only.
- People references on reports (`reporter_guest_id` or `reporter_host_id`, `reviewed_by`, uploader) are plain foreign keys; uploader and content hash are copied onto the report at filing.
- Signed read URLs last 5 minutes. Migration truncates `events` and `photos` first.
- Mail is Gmail SMTP through `nodemailer` (T009). Create the Gmail app password and set `OPERATOR_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APP_BASE_URL` before real use.
- Report limit: 5 per guest per event per rolling 15 minutes. Password reset tokens: 30 minutes, 3 per host per hour.
- Host email verification is non-blocking: nothing reads `email_verified_at` except the dashboard reminder. Tokens last 7 days, 3 per host per hour; a completed password reset also verifies. Harmful-report alerts go to the operator regardless.
- Upload limit: 200 upload intents per guest per event per rolling hour, counting failed ones; hosts exempt.
- The Phase 1 gallery features are rebuilt (US8): viewer with previous/next and swipe, per-photo download through a 5-minute signed link, visible-photo count, share link. The host QR lives on the host dashboard, not in the guest gallery.
- The owning host can delete any photo directly and may mark it harmful, which creates the same evidence as an upheld guest report with the host as reporter and reviewer (`reporter_host_id`); open reports on that photo close as upheld; no email is sent.
- Guest identity deletion requires an explicit confirmation (`{confirm:true}` on the API).
- Auto-resolve happens within 96 hours of filing because the sweep runs once a day.
- Guest verification is a channel-agnostic `VerificationProvider` (`send(identifier)`, `verify(identifier, code)`) with a `channel` config value (`VERIFICATION_CHANNEL=email` for now). The active implementation is `EmailOtpProvider`, using the existing Mailer. There is no dev OTP provider, no `devCode`, and no `ALLOW_DEV_OTP`; codes are real and never returned or logged.
- Guest identity is generic: `guests.identifier` (text) + `guests.channel` (text, `email` today, `phone` anticipated) + `guests.verified_at`, with UNIQUE `(identifier, channel)`. There is no email or phone column. A future phone channel adds rows with `channel='phone'`, existing email-verified guests are untouched, and no migration is needed. Guest lookup and creation at verification is by `(identifier, channel)` through lib/verification/guest-identity.ts. Consent, `event_guests`, media, reports, and sessions need no change because they key off `guest_id`.
- The `VerificationProvider` interface has exactly two operations (`send`, `verify`); the channel is configuration, each provider validates and normalizes its own identifiers, and the email provider owns its own throttles because it owns `otp_codes` and the mail allowance.
- `otp_codes` rows are kept for at least 25 hours regardless of expired or used status, so the rolling-window counters that count them are never reset early; housekeeping is registered as a step in the sweep.
- The QR route is part of US1 (before the dashboard). `GET /api/e/:token` returns an `isOwnerHost` flag, and the gallery and upload pages have an explicit owner-host mode.
- A duplicate upload that matches a hidden photo returns `{duplicate:true}` with no media id.
- Before the first real event, a mail capacity rehearsal (T077) must prove the Gmail account can carry the expected peak, or the mailer moves to a verified-domain provider (a release gate).
- Verification emails are capped by a generous daily system-wide cap (400 by default, `VERIFICATION_DAILY_CAP`) with no tight hourly limit, so one reception can verify together; harmful alerts and auto-hold notices are exempt. A resend while the previous code is still valid and unused does not count against the per-address new-code limit.
- Every email (guest verification code, host signup verification, password reset, harmful alert, auto-hold digest, sweep-failure alert) is sent through `after()`. The photo is hidden inside the report's own transaction regardless of email; durability comes from `alerted_at` / `auto_hold_notified_at` retry on the next sweep.
- `event_hosts.event_id` cascades on delete (plain join table). `media` deliberately has no cascade from `events`, so the purge sequence stays in application control; the migration comments say so to stop it being "fixed" later.
- At an event the caller owns, a host session always resolves as host, even if the same person also holds a guest session.
- Filing a report locks the media row (`SELECT … FOR UPDATE`) to close the report-versus-delete race.
- Accepted, no change: signup returns a conflict for an existing email, which reveals registered emails. Login and reset do not.

## Release gates

- The automated purge/evidence and tenant-isolation tests (T071) must pass, and the timed quickstart checks (scenario 29) must be met.
- **Mail capacity rehearsal (T077, quickstart scenario 32) must pass before the first real event.** If the Gmail account cannot carry the expected peak guest count plus an alert reserve, moving to a verified-domain provider (for example Resend) is a release gate, not a later upgrade.

## Still open (not tasked)

- **SMS transition policy**: whether email-verified guests must later also verify a phone, or both stay valid, is not decided: a person who verifies on a second channel is a separate guest identity until a linking policy is decided. No migration is needed to add the channel itself. See the plan's SMS swap path.
- A cap on total open reports per guest, a per-guest upload byte-volume cap, changing a host's email, backups, a storage abstraction, wrap-up and close-prompt emails.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and configuration

- [ ] T001 Add runtime dependencies `bcryptjs`, `sharp`, `heic-convert`, `nodemailer` (and `@types/bcryptjs`, `@types/nodemailer`) in package.json
- [ ] T002 [P] Update .env.example: remove `SESSION_SECRET`; add `VERIFICATION_CHANNEL`, `VERIFICATION_PEPPER`, `VERIFICATION_DAILY_CAP`, `CRON_SECRET`, `MAIL_PROVIDER`, `MAIL_FROM`, `OPERATOR_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APP_BASE_URL`, with comments (`VERIFICATION_CHANNEL=email` is the current channel; the daily cap defaults to 400; `MAIL_PROVIDER=gmail` sends real email using a Gmail app password, `console` prints only template names and is for local development only; `APP_BASE_URL` is used in emailed links)
- [ ] T003 [P] Add `vercel.json` with one daily cron entry calling `/api/cron/sweep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, identity plumbing, and shared helpers that every story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Write migration db/migrations/003_identity_trust_media.sql that **first truncates `events` and `photos`**, then drops `photos` and `events.pin` and creates or alters, exactly as in data-model.md: `hosts` (`failed_login_count`, `locked_until`, `email_verified_at`, nullable `email`/`password_hash`), `host_sessions`, `password_reset_tokens`, `email_verification_tokens`, `events` (unique `access_token`, `closed_at`, `deleted_at`, `purge_after`), `event_hosts` (`event_id` `ON DELETE CASCADE`), `guests` (`identifier` text, `channel` text (`email` today, `phone` anticipated, validated by the provider layer, no CHECK so a new channel needs no migration), and `verified_at`, all three nullable after tombstone with a CHECK that they are all null or all set, UNIQUE `(identifier, channel)`; nullable `name`; `deleted_at`; no email or phone column), `guest_sessions`, `event_guests`, `otp_codes` (`identifier` (an email now, a phone if a phone channel is ever active), `code_hash`, `expires_at`, `attempt_count`, `created_at`, `used_at`, `is_resend`), `media`, `upload_intents`, and `reports` (`reporter_guest_id` and `reporter_host_id` (exactly one set, `CHECK (num_nonnulls(reporter_guest_id, reporter_host_id) = 1)`) and `reviewed_by` plain FKs `ON DELETE RESTRICT`; `uploader_guest_id`, `uploader_host_id` plain FKs `ON DELETE RESTRICT`; `content_hash`; `media_id` and `event_id` `ON DELETE SET NULL`; `alerted_at`, `auto_hold_notified_at`). Include both `num_nonnulls(...) = 1` CHECKs on `media` and `upload_intents`, the same CHECK on the report uploader columns, the partial unique index `(event_id, content_hash) WHERE deleted_at IS NULL`, reason and status CHECKs, the partial unique index `(media_id, reporter_guest_id) WHERE status = 'open'`, and the indexes `(reporter_guest_id, event_id, created_at)` on `reports` and `(guest_id, event_id, created_at)` on `upload_intents`. Put SQL comments in the migration explaining the cascade distinction: `event_hosts.event_id` cascades because it is a plain join table that must never block deleting an event, while `media.event_id` and every `reports` link deliberately have no cascade (`media` keeps the default no-action) so the purge sequence (detach harmful evidence, delete media explicitly, then delete the event) stays in the application's control and the database never silently cascades media away first; mark both with `COMMENT ON` and the words "do not add a cascade to media"
- [x] T005 [P] Implement redaction-aware logger in lib/log.ts that drops keys `identifier`, `email`, `phone`, `code`, `token`, `password`, `newPassword` and exposes `logError`/`logInfo`
- [x] T006 [P] Implement explicit validators in lib/validate.ts: email, password (10 to 72 bytes), the 6-digit code (guest identifiers are validated and normalized by the active verification provider, not here), UUID, access token format, 43-character base64url reset or verification token, guest name (1 to 60 characters, no control characters), report reason enum, note length, file size/type constants, `parseJsonBody` helper
- [x] T007 [P] Implement token helpers in lib/auth/tokens.ts: generate 32-byte base64url token, SHA-256 hash, constant-time compare, cookie option builder (httpOnly, SameSite=Lax, Secure outside development)
- [x] T008 [P] Implement typed auth and domain errors and a route error mapper in lib/auth/errors.ts (401/403/404/409/429, generic auth failure messages, codes `consent_required`, `event_closed`, `report_limit`, `upload_limit`, each 429 with `Retry-After`)
- [x] T009 [P] Implement the mailer: lib/notify/mailer.ts (interface `send(to, subject, text)`), lib/notify/gmail-mailer.ts (`nodemailer` over `smtp.gmail.com` port 465 with `GMAIL_USER` and app password `GMAIL_APP_PASSWORD`, transport created per call with about 10 s connect and 15 s socket timeouts and closed after sending, never logging bodies or credentials; a Gmail 4xx throttling response is treated as a transient failure that is logged without personal data and left to the existing retry paths, so a guest simply requests a resend), lib/notify/console-mailer.ts (development only; prints just the template name, never the recipient or body, since a guest's email is an identifier under XII), lib/notify/memory-mailer.ts (tests only; captures messages in memory without logging them), lib/notify/index.ts (select from `MAIL_PROVIDER`; throw if `console` in production or if `gmail` lacks a credential), and lib/notify/templates.ts (guest-verification-code, harmful-alert, auto-hold digest, password-reset, email-verification, and sweep-failure emails; the verification-code email contains only the code and a short expiry note; alerts and digests contain event name, reason, time, and a dashboard link under `APP_BASE_URL` only, never guest identifiers, tokens, or image URLs; the reset and verification emails contain only their link, `APP_BASE_URL/reset-password#token=…` and `APP_BASE_URL/verify-email#token=…`; the sweep-failure email contains only the failed step name, the time, and an error class, never personal data). Callers send every email through Next.js `after()`, never awaited in the response path, and routes that send email set `export const maxDuration = 60`
- [x] T010 Implement host session store and `requireHost()` in lib/auth/host.ts (create, lookup by token hash, sliding 12 h expiry, revoke one or all for a host, reject soft-deleted and tombstoned hosts)
- [x] T011 Implement guest session store and `requireGuest()` in lib/auth/guest.ts (create, lookup by token hash, 180-day expiry, revoke, reject tombstoned guests); sessions refer to the guest by `guest_id` only
- [x] T012 Implement `requireEventHost(eventId)` and `resolveEventByToken(token)` in lib/auth/guards.ts using `event_hosts` and `events.deleted_at`; unknown or other-tenant events return not found (depends on T010). Also implement `resolveEventActor(event)` there: it returns the host whenever the caller holds a valid host session and owns that event, even if a guest session is also present (for example from testing), and otherwise the guest
- [x] T013 Remove the Phase 1 PIN model. **First commit or copy the current app/e/[eventId]/gallery/page.tsx (it has uncommitted changes that git history won't hold) so the viewer, download, count, and share logic can be ported in US8.** Then delete app/api/events/, app/api/session/, app/e/[eventId]/, lib/session.ts, and rewrite or remove app/page.tsx and any other file importing them (the `[eventId]` segment would clash with `[token]`)
- [x] T014 Extend lib/storage.ts for a private bucket: create temp signed upload URL under `tmp/`, download object bytes, upload processed object, delete object, mint signed read URLs valid 5 minutes; remove the public URL helper
- [x] T015 Apply migration 003 to the development database; confirm `events` and `photos` started empty, both uploader CHECKs (and the report uploader CHECK) reject an insert with both or neither, and deleting a guest or host referenced by a report is blocked by `RESTRICT` (quickstart scenarios 6 and 19), deleting an event that has `event_hosts` rows succeeds through the cascade, and deleting an event that still has `media` rows is refused (no cascade on media, by design). Delete leftover Phase 1 files under `events/` in the Storage bucket by hand

**Checkpoint**: Foundation ready. Identity guards, validators, logging, mailer, storage, and schema exist.

---

## Phase 3: User Story 1 - Host account, multiple events, password reset, closing (Priority: P1) 🎯 MVP

**Goal**: A host signs up, logs in, creates more than one event, sees only their own, can reset a forgotten password, can close and reopen an event, and is gently reminded (never blocked) to verify their email.

**Independent Test**: quickstart scenarios 1, 14, 20, 21, and 24.

- [x] T016 [P] [US1] Implement password hash/verify (bcryptjs, cost 12, reject over 72 bytes) in lib/auth/password.ts
- [x] T017 [P] [US1] Implement host, event, and reset-token queries (create host, find by normalized email, record failed login and lock, reset on success, create event with owner row, list own events, get event, set or clear `closed_at`, create reset token invalidating older unused ones, count a host's tokens in the last hour, consume a token; the same create, count, and consume operations for email-verification tokens, plus set `email_verified_at`) in lib/queries/hosts.ts, lib/queries/events.ts, lib/queries/reset-tokens.ts, and lib/queries/verification-tokens.ts
- [x] T018 [US1] Implement POST /api/auth/host/signup in app/api/auth/host/signup/route.ts (validate, reject weak password, normalize email, create host and session cookie; duplicate email returns a conflict (an accepted tradeoff: it reveals registered emails, unlike login and reset, which never do); create a verification token and email the confirmation link with Next.js `after()` so signup never fails or slows because of email; `export const maxDuration = 60`)
- [x] T019 [US1] Implement POST /api/auth/host/login in app/api/auth/host/login/route.ts with lockout: 5 consecutive failures set `locked_until` 15 minutes ahead; while locked return the same generic 401 without checking the password; success resets the count; unknown email runs a dummy hash to equalize timing
- [x] T020 [US1] Implement POST /api/auth/host/logout in app/api/auth/host/logout/route.ts (revoke session, clear cookie)
- [x] T021 [US1] Implement GET and POST /api/host/events in app/api/host/events/route.ts (list only the caller's events with their closed state; create with `access_token` and exactly one `owner` `event_hosts` row in one transaction)
- [x] T022 [US1] Implement PATCH /api/host/events/[eventId] in app/api/host/events/[eventId]/route.ts (rename, `rotateToken`, `{closed:true}` to close, `{closed:false}` to reopen), guarded by `requireEventHost`
- [x] T023 [US1] Implement password reset in lib/auth/password-reset.ts and app/api/auth/host/password-reset/request/route.ts and app/api/auth/host/password-reset/confirm/route.ts: request always returns the same 202 (unknown email, deleted account, and throttled all look identical; set `export const maxDuration = 60` so the post-response email can finish), creates a 30-minute single-use token only for an existing host under 3 tokens per hour, and emails the link with Next.js `after()` so timing does not reveal the account; confirm validates the token, enforces password rules, stores the new bcrypt hash, marks the token used, deletes all of the host's sessions, clears `failed_login_count` and `locked_until`, sets `email_verified_at` if it was null (the reset link proved inbox control), does not log in, and returns a generic 400 for invalid, expired, or used tokens
- [x] T024 [US1] Implement host email verification in lib/auth/email-verification.ts, app/api/auth/host/email-verification/resend/route.ts, app/api/auth/host/email-verification/confirm/route.ts, and app/api/host/me/route.ts: tokens are 32 random bytes with only the SHA-256 stored, 7-day expiry, single use; resend (`requireHost`) invalidates older unused tokens, is limited to 3 per host per rolling hour (429), and is a no-op if already verified; the email is sent with `after()` and the route sets `maxDuration = 60`; confirm needs no login, validates the token, sets `hosts.email_verified_at`, and returns a generic 400 for invalid, expired, or used tokens; `GET /api/host/me` returns `{email, emailVerified}`; no route, guard, or query may read `email_verified_at` to block any action (it only drives the dashboard reminder)
- [x] T025 [P] [US1] Build host signup, login, forgot-password, reset-password, and verify-email pages in app/(host)/signup/page.tsx, app/(host)/login/page.tsx, app/(host)/forgot-password/page.tsx, app/(host)/reset-password/page.tsx, and app/(host)/verify-email/page.tsx (the reset and verify pages read the token from the URL fragment and post it in the body, never as a query string)
- [x] T026 [P] [US1] Implement GET /api/host/events/[eventId]/qr in app/api/host/events/[eventId]/qr/route.ts (`requireEventHost`; returns a PNG QR code, via lib/qr.ts, of the event's current link `APP_BASE_URL/e/<accessToken>`) and show it beside the share link on the host dashboard event view (T027)
- [x] T027 [US1] Build host dashboard event list and create-event form in app/(host)/dashboard/page.tsx, showing each event's share link with its QR code beside it (from the QR route, T026; the guest gallery shows no QR), a close/reopen control with a closed indicator, and a persistent unverified-email reminder (from `GET /api/host/me`) with a resend-link button, shown until the email is verified and never blocking any action

**Checkpoint**: US1 fully functional. Host can sign up, recover their password, manage several events in isolation, close or reopen them, and is reminded to verify their email without being blocked.

---

## Phase 4: User Story 2 - Guest email verification that persists (Priority: P1)

**Goal**: A guest views any event freely, verifies once by an emailed code, and stays recognized at other events.

**Independent Test**: quickstart scenarios 2, 12, and 15.

- [x] T028 [P] [US2] Define the channel-agnostic `VerificationProvider` interface in lib/verification/provider.ts with **exactly two operations**, `send(identifier)` and `verify(identifier, code)`: `verify` returns the provider-normalized identifier on success or null, and both throw typed errors (invalid identifier; rate limited with a retry-after) that routes map to 400 and 429. The channel is configuration (`VERIFICATION_CHANNEL`), not an interface member; each provider validates and normalizes identifiers of its own channel internally; nothing outside the provider layer may depend on which channel or provider is active
- [x] T029 [P] [US2] Implement the email provider's throttling in lib/verification/email-throttle.ts, used only by `EmailOtpProvider` (it owns `otp_codes` and the mail allowance; a provider that verifies through a vendor uses the vendor's limits): **new codes** (sent while no valid unused code exists) limited to 5 per identifier per rolling hour; **resends** (sent while a previous code is still valid and unused) limited to 10 per identifier per rolling hour and at least 30 seconds apart, and not counted against the new-code limit; a **generous system-wide daily cap** of 400 verification emails per rolling day (`VERIFICATION_DAILY_CAP`) with no short-window system-wide limit (alerts and notices never counted or blocked); verification attempts refuse when the sum of `attempt_count` across that identifier's codes created in the last hour reaches 10; all counts read `otp_codes` rows, which are kept at least 25 hours (T069)
- [x] T030 [US2] Implement `EmailOtpProvider` in lib/verification/email-otp-provider.ts: validate and normalize the email (valid shape, max 254, trimmed, lowercase), generate a 6-digit code, store its HMAC-SHA256 with `VERIFICATION_PEPPER` in `otp_codes` with a 10-minute expiry, single use **enforced atomically** (`UPDATE otp_codes SET used_at = now() WHERE id = … AND used_at IS NULL AND expires_at > now() RETURNING`, succeeding only when a row comes back, so two simultaneous confirms with one code cannot both pass), and `is_resend` set when an earlier code for the identifier is still valid and unused; a wrong code increments `attempt_count` on **every currently valid code** for that identifier (so extra valid codes never multiply guessing) and a code is refused at 5; older unused codes stay valid until they expire (at most 3 valid at once, oldest dropped) and verify checks the submitted code against the identifier's valid codes; apply the throttles from T029 inside `send` and `verify`; email the code through the Mailer inside `after()`; `send` never returns or logs the code; no dev shortcut, no `devCode`
- [x] T031 [US2] Implement provider selection from `VERIFICATION_CHANNEL` (`email` for now) in lib/verification/index.ts (the only file that names a concrete provider, and it exports a test-only `registerProvider(channel, provider)` that throws unless `NODE_ENV === 'test'`, used by the channel-swap test in T071; it also holds each channel's UI hints, `inputType` and `label`), lib/verification/guest-identity.ts (find or create a guest by `(identifier, channel)`, where the identifier is what `verify` returned and the channel is the configured one, setting `verified_at`, using `INSERT … ON CONFLICT (identifier, channel) DO NOTHING` then a select so simultaneous first-time confirms for one address yield one guest; a future phone channel adds rows with `channel='phone'` and leaves email guests untouched, with no migration and no per-channel branching), and GET /api/auth/guest/verification/config in app/api/auth/guest/verification/config/route.ts returning `{channel, inputType, label}` so the UI needs no knowledge of the channel
- [x] T032 [US2] Implement POST /api/auth/guest/verification/send in app/api/auth/guest/verification/send/route.ts (call the provider, which validates the identifier and applies its own throttles; always answer the same `202` and never include the code; map an invalid identifier to 400 and a rate-limit error to `429` with `Retry-After`; `export const maxDuration = 60` so the post-response email can finish)
- [x] T033 [US2] Implement POST /api/auth/guest/verification/confirm in app/api/auth/guest/verification/confirm/route.ts (call `verify`, which validates, throttles, and returns the normalized identifier; find or create the guest through lib/verification/guest-identity.ts by `(identifier, channel)` with `name` null; create the guest session cookie; generic 401 on any failure; 429 on a rate-limit error). After this step nothing else reads `guests.identifier` or `channel`: sessions, consent, `event_guests`, media, reports, and evidence all use `guest_id`
- [x] T034 [US2] Implement POST /api/auth/guest/logout in app/api/auth/guest/logout/route.ts
- [x] T035 [US2] Implement GET /api/e/[token] in app/api/e/[token]/route.ts (no auth required; event name, `closed` flag, the visible-photo `count` (excluding hidden and deleted), visible media with 5-minute signed URLs and each uploader's display name or none, caller's verified and consent state, and an `isOwnerHost` flag (true only when the caller's valid host session owns this event, from `resolveEventActor`); an existing valid guest session counts as verified for any event)
- [x] T036 [US2] Build the public gallery page (viewable without sign-in, with a closed-event banner that hides the upload control) in app/e/[token]/page.tsx; when `isOwnerHost` is true the page enters **owner-host mode**: it shows the host's controls (delete with an optional harmful mark, through the viewer's host slot) and an upload control that acts as the host, with no verification, consent, or name prompts
- [x] T037 [US2] Build the verification UI in app/e/[token]/verify/page.tsx: read the input type and label from the config route (T031), then identifier entry and code entry, with a resend button (available while a code is pending, with the cooldown shown) and clear messages for the new-code limit and the daily cap, and prompt it when an unverified visitor tries to upload or report; the page never shows or handles a code other than what the guest types
- [x] T038 [US2] Confirm a verified guest opening a second event's link is not asked to verify again (quickstart scenario 2), adjusting T035 and T037 if needed

**Checkpoint**: US2 works. Guests view freely and verify once per device by a real emailed code.

---

## Phase 5: User Story 8 - Browse, download, and share the gallery (Priority: P1)

**Goal**: Anyone with an event link browses visible photos with a count, opens a full-size viewer with previous/next (buttons, arrow keys, swipe), downloads through a short-lived signed link, and shares the link. The host's QR code lives on the host's dashboard, not in the guest gallery. This rebuilds the Phase 1 gallery features on the new model.

**Independent Test**: quickstart scenario 26.

- [x] T039 [P] [US8] Implement GET /api/e/[token]/media/[mediaId]/download in app/api/e/[token]/media/[mediaId]/download/route.ts: no auth needed, only for visible, non-deleted media in that event (otherwise 404), respond `302` to a 5-minute signed URL that forces download with a sensible filename (never a public URL), `Cache-Control: no-store`; works on closed events
- [x] T040 [P] [US8] Build the full-size viewer in components/gallery/Lightbox.tsx, porting the Phase 1 behavior: opens from a photo, previous/next controls (disabled at the first and last photo), ArrowLeft/ArrowRight/Escape keys, touch swipe with a distance threshold, a download button calling T039, slots for the report control (T057) and the host delete control (T070, rendered only when `isOwnerHost`), and staying on a valid photo (or closing) if the current photo disappears when the list refreshes
- [x] T041 [US8] Build components/gallery/ShareButton.tsx (Web Share API where available, copy-link fallback with a confirmation) and wire the gallery page app/e/[token]/page.tsx to show the visible-photo count from the API, open the viewer (T040) from each photo, and show the share button; the guest gallery shows no QR (depends on T036, T040)

**Checkpoint**: US8 works. The Phase 1 gallery features are back, on signed links and the new identity model.

---

## Phase 6: User Story 3 - Per-event consent (Priority: P1)

**Goal**: A guest consents to each event's audience disclosure before their first upload there.

**Independent Test**: quickstart scenario 3.

- [x] T042 [P] [US3] Define the current consent version constant and disclosure text builder in lib/consent.ts
- [x] T043 [US3] Implement POST /api/e/[token]/consent in app/api/e/[token]/consent/route.ts (requires `requireGuest`, upserts `event_guests` with `consented_at` and `consent_version`)
- [x] T044 [US3] Add a consent check helper `requireConsent(guestId, eventId)` in lib/auth/guards.ts that fails with code `consent_required` unless the version matches
- [x] T045 [US3] Build the consent screen in app/e/[token]/consent/page.tsx, shown before a guest's first upload in that event; declining returns to the gallery with nothing uploaded

**Checkpoint**: US3 works. Consent is per guest per event.

---

## Phase 7: User Story 4 - Upload with integrity checks (Priority: P1)

**Goal**: Host or consenting guest uploads a photo; server verifies, dedupes, strips metadata, converts, thumbnails; exactly one uploader; closed events refuse uploads; guests are offered an optional name.

**Independent Test**: quickstart scenarios 4, 5, 6, 18, 20, 23, and 25.

- [ ] T046 [P] [US4] Implement magic-byte type sniffing and size checks (JPEG, PNG, WebP, HEIC/HEIF, 25 MB) in lib/media/sniff.ts
- [ ] T047 [P] [US4] Implement the processing pipeline in lib/media/process.ts (HEIC via `heic-convert`, `sharp().rotate()`, metadata stripped, display JPEG max 2560 px, thumbnail JPEG max 480 px)
- [ ] T048 [P] [US4] Implement storage path builders in lib/media/paths.ts (`tmp/…`, `events/<eventId>/<mediaId>.jpg`, `.thumb.jpg`)
- [x] T049 [US4] Implement POST /api/e/[token]/uploads (resolve actor, check closed, validate fields, require guest consent, throttle guest uploads, create upload_intent, return signed URL)
- [x] T050 [US4] Implement finalize in lib/media/finalize.ts (load intent, download, SHA-256, process, dedup, upload, cleanup, mark finalized)
- [x] T051 [US4] Implement POST /api/e/[token]/uploads/[intentId]/finalize endpoint
- [x] T052 [US4] Add PATCH /api/guest/me for name storage + GET /api/guest/me (note: upload UI T052b remains)
- [x] T053 [US4] Update gallery API and page (thumbnail URLs, refresh every 4min, retry on error, show uploader kind)

**Checkpoint**: US4 works. Verified, processed, deduplicated photos with a single traceable uploader.

---

## Phase 8: User Story 5 - Report a photo; hidden immediately (Priority: P1)

**Goal**: A verified guest reports a photo and it disappears at once, within a per-guest limit; the report preserves the uploader and file hash; a harmful report emails the host and the operator immediately.

**Independent Test**: quickstart scenarios 7, 16, and 22 (needs the viewer from US8, T040, for the report control).

- [ ] T054 [P] [US5] Implement the per-guest report limit in lib/reports/limit.ts: count a guest's reports in an event over the last 15 minutes across all statuses, refuse at 5 with `report_limit`, and take `pg_advisory_xact_lock(hashtext(reporter_guest_id || event_id))` so simultaneous requests cannot both pass
- [ ] T055 [US5] Implement POST /api/media/[mediaId]/report in app/api/media/[mediaId]/report/route.ts (`requireGuest`, validate reason and note, reject missing or already-deleted media; in one transaction first `SELECT … FOR UPDATE` the media row (so a simultaneous uploader or host deletion cannot slip past the deleted-media check), then apply T054, insert the report **copying the media's uploader (`uploader_guest_id` or `uploader_host_id`) and `content_hash`**, and set `media.visibility = 'hidden'`; 409 on an existing open report by this guest; 429 `report_limit` with `Retry-After`; works on closed events; after commit call T056 for `harmful`; `export const maxDuration = 60`)
- [ ] T056 [US5] Implement the harmful alert in lib/reports/alert.ts: after the hide has committed, send the email to the event's owner host and `OPERATOR_EMAIL` through the mailer inside `after()` so the report response never waits on SMTP, and set `reports.alerted_at` on success; a mail failure is logged (no personal data), never undoes the hide, and is retried by the next sweep
- [ ] T057 [US5] Add a report button and reason picker to the viewer's report slot (T040) in components/gallery/Lightbox.tsx, prompting verification first for unverified visitors, and show a clear message when the report limit is reached

**Checkpoint**: US5 works. A reported photo is gone from all viewers before any host action, the limit blocks mass-hiding, and harmful reports trigger email.

---

## Phase 9: User Story 6 - Host reviews reports; unreviewed reports fail safe (Priority: P2)

**Goal**: Hosts uphold or dismiss reports; every report unreviewed after 72 hours auto-resolves.

**Independent Test**: quickstart scenarios 8, 9, 17, and 27.

- [ ] T058 [US6] Implement GET /api/host/events/[eventId]/reports in app/api/host/events/[eventId]/reports/route.ts (`requireEventHost`; open first, harmful first; signed thumbnail URLs)
- [ ] T059 [US6] Implement PATCH /api/host/reports/[reportId] in app/api/host/reports/[reportId]/route.ts (verify the caller hosts the report's event; `dismiss` restores `visible` and closes; `uphold` keeps hidden, closes, and queues media for purge; record `reviewed_by`; works on closed events)
- [ ] T060 [US6] Build the report review dashboard in app/(host)/dashboard/events/[eventId]/reports/page.tsx with an open-report badge on the dashboard event list
- [ ] T061 [US6] Implement auto-hold in lib/cron/auto-hold.ts: every open report older than 72 hours, whatever its reason, becomes `auto_held` with the photo kept hidden; then, inside `after()`, email each affected host one digest, setting `auto_hold_notified_at` on success; also retry harmful alerts with `alerted_at` null and digests with `auto_hold_notified_at` null
- [ ] T062 [US6] Implement GET /api/cron/sweep in app/api/cron/sweep/route.ts with constant-time bearer `CRON_SECRET` check and an idempotent step runner, wiring T061; run each step in its own try/catch so one failing step does not stop the others; if any step throws, send the operator a sweep-failure email inside `after()` (step name, time, and error class only, no personal data), log it through lib/log.ts, and respond 500 so Vercel records the failure; set `maxDuration = 60`

**Checkpoint**: US6 works. Reports resolve by host decision or fail safe, and hosts are told by email.

---

## Phase 10: User Story 7 - Deletion and surviving evidence (Priority: P2)

**Goal**: Separate guest media and identity deletion; host event and account soft-delete then purge; harmful evidence survives with reporter, reviewer, uploader, and hash.

**Independent Test**: quickstart scenarios 10, 11, 17, 27, and 28.

- [ ] T063 [US7] Implement DELETE /api/media/[mediaId] in app/api/media/[mediaId]/route.ts (the uploader, or the owning host of the event who may delete any photo in it, refusing other hosts with 403; soft delete with a short `purge_after`; works on closed events. For the owning host, accept optional `{harmful:true}` and in one transaction that first locks the media row: close any open reports on it as `upheld` with `reviewed_by` set, and if `harmful`, insert one evidence report directly as `upheld`, reason `harmful`, `reporter_host_id` and `reviewed_by` both the host, uploader and `content_hash` copied from the media, `resolved_at` now, never `open`; send no email; a deletion not marked harmful creates no report)
- [ ] T064 [US7] Implement POST /api/auth/guest/delete in app/api/auth/guest/delete/route.ts (require body `{confirm:true}` and return 400 otherwise, the UI having shown the FR-050 confirmation first; tombstone `guests` row: clear `identifier`, `channel`, and `verified_at`, keep `name`, set `deleted_at`, remove `guest_sessions` and `event_guests`; media and its display stay exactly as before)
- [ ] T065 [US7] Implement DELETE and restore for events in app/api/host/events/[eventId]/route.ts and app/api/host/events/[eventId]/restore/route.ts (soft delete with `purge_after = now() + 30 days`; restore within grace)
- [ ] T066 [US7] Implement DELETE /api/host/account in app/api/host/account/route.ts (soft delete host and all their events, revoke sessions)
- [ ] T067 [US7] Implement evidence-preserving purge in lib/cron/purge.ts per data-model.md: open harmful reports to `auto_held`; null `media_id` and `event_id` on harmful upheld or auto-held reports (the row, `reporter_guest_id` or `reporter_host_id`, `reviewed_by`, uploader, and `content_hash` stay; this includes host-marked removals); delete all other reports; delete media rows and Storage objects explicitly (there is deliberately no database cascade on `media`), then events; tombstone (never delete) any host or guest referenced by harmful evidence as reporter, reviewer, or uploader, otherwise delete; one transaction per target
- [ ] T068 [US7] Wire purge of media past `purge_after` or upheld, events past `purge_after`, and hosts past `purge_after` into the sweep in app/api/cron/sweep/route.ts
- [ ] T069 [US7] Add sweep housekeeping in lib/cron/housekeeping.ts and **register it as a step in the sweep route** app/api/cron/sweep/route.ts (after T068): delete expired sessions, expired or used `password_reset_tokens` and `email_verification_tokens`, abandoned temp uploads past intent expiry, processed objects under `events/` with no `media` row, and `otp_codes` rows **only when older than 25 hours regardless of expired or used status**, so the rolling-window counters that count these same rows are never reset early
- [ ] T070 [P] [US7] Add delete and restore controls in app/(host)/dashboard/page.tsx and account deletion with confirmation in app/(host)/account/page.tsx; add a guest "your details" control in app/e/[token]/page.tsx to set, edit, or remove the display name, and guest "delete my photo" and separate "delete my identity" controls, where deleting identity first shows a confirmation (your photos will remain and you can't delete them afterward unless you remove them first) and does nothing unless confirmed; add a delete control with an optional "mark as harmful" checkbox to the viewer's host slot (T040) for the owning host

**Checkpoint**: US7 works. Privacy deletions and evidence retention behave per FR-028 to FR-032.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T071 [P] Add `node --test` cases (with a TypeScript runner such as `tsx` added in package.json, a test database, and migration 003 applied to it) in tests/unit/auth-tokens.test.ts, tests/unit/email-otp-provider.test.ts (code hashing, single use, expiry, attempt limit, a new send invalidating the old code, the code never in a response or log), tests/unit/verification-caps.test.ts (new-code and resend limits per identifier, that a resend does not count against the new-code limit, that a stranger's repeated requests do not stop a real guest getting a code, the daily cap with no hourly cap so 300 guests can verify in an hour, that housekeeping never deletes `otp_codes` rows younger than 25 hours, and that alerts still send at the cap), tests/unit/login-lockout.test.ts, tests/unit/password-reset.test.ts (single use, expiry, only newest link, throttle), tests/unit/email-verification.test.ts (same rules, and verification never blocks an action), tests/integration/dedupe-race.test.ts (two concurrent inserts yield one row), tests/integration/report-limit.test.ts (concurrent reports cannot exceed 5), tests/integration/actor-precedence.test.ts (a host session wins over a guest session at an owned event), tests/integration/sweep-failure.test.ts (a throwing step sends the operator email and the other steps still run), tests/integration/channel-swap.test.ts (registers a test-only `FakePhoneProvider` with channel `phone` against the real schema with no migration: a guest verifies by phone and another by email in the same run, as separate rows keyed by `(identifier, channel)`; consent, upload, report, evidence, and identity deletion all work for the phone guest with no other code change; the email guest's row is untouched; the same identifier string under two channels does not collide; and the unique constraint rejects a duplicate `(identifier, channel)`), and two **release-blocking** suites: tests/integration/purge-evidence.test.ts (after media and event purge, harmful evidence keeps the reporter or host reporter, reviewer, uploader, and `content_hash`; non-harmful and dismissed reports are deleted; people referenced by evidence are tombstoned, never deleted; the purge works without any database cascade on media) and tests/integration/tenant-isolation.test.ts (host A cannot read, change, close, delete, list reports of, or fetch the QR for host B's events, media, or reports, and unknown or foreign ids return 404); all need a local Postgres
- [ ] T072 [P] Audit all routes and lib code for logging of guest email addresses, verification codes, session, reset, or verification tokens, passwords, or the Gmail app password (grep for `console.`), routing everything through lib/log.ts (quickstart scenarios 13 and 21), and confirm nothing outside lib/verification (including guest-identity.ts) and the identity-deletion route (which only clears them) reads or writes `guests.identifier`, `channel`, or `verified_at`, and that no code branches on a channel name: sessions, consent, media, reports, and evidence must use `guest_id` only
- [ ] T073 [P] Verify the production gates (quickstart scenario 12): verification responses never contain a code, `MAIL_PROVIDER=console` refuses to start in production, and the mailer refuses to start if the Gmail credentials are missing
- [ ] T074 [P] Update README.md: remove PIN and anonymous-guest description, document new environment variables, migration 003 (it truncates), cron, the email verification provider and how to add a new channel (one provider plus `VERIFICATION_CHANNEL`), the verification-email caps, how to create the Gmail app password (needs 2-Step Verification), and `APP_BASE_URL`
- [ ] T075 Run the full quickstart.md scenarios 1 to 32 against a real device, including an iPhone HEIC photo and real inboxes for scenarios 16, 21, and 24 and every verification email (check spam), and record results
- [ ] T076 [P] Run `npm run lint` and `npm run build` and fix issues
- [ ] T077 **Mail capacity rehearsal (release gate; quickstart scenario 32)**: with `EXPECTED_PEAK_GUESTS` set to the real event's guest count, send a realistic batch of verification emails through the Gmail account to inboxes you control (several addresses and providers, never third parties), spread like a real reception **and including a concurrent burst** (request verification for the full `EXPECTED_PEAK_GUESTS` addresses, using many aliases you control, within about 5 minutes) to expose Gmail connection or login throttling (4xx responses such as 421 or 454) that the daily total would hide, plus a few harmful-alert and digest emails, and record: messages delivered, any Gmail throttling, connection-limit, or daily-limit errors during the burst and over the day, spam placement, median delivery time, and the actual messages the account can send in a day. Pass only if it covers the expected peak with at least 20% headroom plus an alert reserve; otherwise move to a verified-domain provider (for example Resend) as a new Mailer implementation behind `MAIL_PROVIDER` before the event

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup, blocks every story
- **US1 (P1)**: after Foundational. **MVP.** T023 (reset) and T024 (verification) depend on the mailer (T009) and the reset-token queries (T017)
- **US2 (P1)**: after Foundational. Needs an event row to open; use US1 or insert one by SQL
- **US8 (P1)**: after US2 (needs the gallery page T036 and the GET route T035). T026 (the QR route) is in US1 and runs before the dashboard (T027). Its viewer (T040) has slots that US5 (report) and US7 (host delete) fill
- **US3 (P1)**: depends on US2 (needs a verified guest)
- **US4 (P1)**: depends on US1 (host uploads, ownership, closed state), US2 (guest identity), US3 (consent)
- **US5 (P1)**: depends on US2, US4, US8 (the viewer, T040), and the mailer (T009)
- **US6 (P2)**: depends on US5
- **US7 (P2)**: depends on US4, US5, and US8 (the host delete control uses the viewer); T065 extends the file created by T022
- **Polish (Phase 11)**: after the desired stories

### Within Each Story

- Helpers and queries before routes; routes before pages
- T050 depends on T046 to T048 and T014; T051 depends on T050; T055 depends on T054; T056 depends on T009; T033 depends on T030 and T031

### Parallel Opportunities

- Setup: T002, T003
- Foundational: T005 to T009 in parallel; T010 and T011 in parallel once T004 to T008 exist
- US1: T016, T017, T025, T026; US2: T028 and T029; US8: T039 and T040 in parallel; US4: T046 to T048; US5: T054 first; US7: T070 (T069 runs after T068, since both edit the sweep route)
- Polish: T071 to T074, T076

---

## Parallel Example: User Story 4

```bash
Task: "Implement magic-byte type sniffing in lib/media/sniff.ts"
Task: "Implement the processing pipeline in lib/media/process.ts"
Task: "Implement storage path builders in lib/media/paths.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 US1
3. **Stop and validate**: quickstart scenarios 1, 14, 20, 21, 24

### Incremental Delivery

1. Foundation, then US1 (host accounts, reset, close)
2. US2, US8, US3, US4 together form the guest gallery and upload loop; validate scenarios 2 to 6, 15, 18, 23, 25, 26 before moving on
3. US5 then US6 give the moderation loop; validate scenarios 7 to 9, 16, 17, 22
4. US7 completes deletion and evidence retention; validate scenarios 10 and 11
5. Polish, then full quickstart

### Release blockers

Scenarios 5, 7, 10, 12, 13, 16, 17, 20, 21, 22, 25, 26, 27, 28, 29, 30, 31, and 32 must pass before release, along with the automated purge/evidence and tenant-isolation suites in T071. They map to the dedupe race, hide-on-report, evidence survival (with uploader and hash), the secret, real, throttled email verification (including the channel-agnostic swap check), no-secret-logging, the harmful email, auto-resolve for every reason, closing, password reset, the report limit, the upload limit, the gallery features, the host's harmful-marked removal, the guest identity-deletion confirmation, the timed checks, the sweep-failure alert, and actor precedence with the report race. Scenarios 16, 21, and 24 must be run against real inboxes.

---

## Notes

- The Phase 1 removal in T013 leaves the app without a gallery until T035 to T036 land in US2; do not deploy between them
- Commit after each task or logical group
