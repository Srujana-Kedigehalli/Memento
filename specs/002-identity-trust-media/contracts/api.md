# API Contracts: Identity, Trust & Media Handling

All routes are Next.js Route Handlers returning JSON. Cookies: `memento_host` and `memento_guest`
(httpOnly, Secure outside development, SameSite=Lax). Auth failures are generic. Every route
validates its input server-side ([data-model.md](../data-model.md) validation rules) and enforces
identity through the four guards: `requireHost`, `requireGuest`, `requireEventHost(eventId)`,
`resolveEventByToken(token)`.

Common errors: `400` invalid input, `401` not signed in, `403` not allowed, `404` not found
(also used for other tenants' resources, to avoid confirming existence), `409` conflict,
`429` throttled. Machine-readable `code` values: `consent_required`, `event_closed`, `upload_limit`,
`report_limit`.

## Host auth

| Route | Auth | Body | Result |
|---|---|---|---|
| `POST /api/auth/host/signup` | none | `{email, password}` | `201`, sets host cookie; `409` if the email is already registered (an accepted tradeoff for signup usability; login and reset never reveal registration) |
| `POST /api/auth/host/login` | none | `{email, password}` | `200`, sets cookie; `401` generic on any failure, including while the account is locked (5 failures locks for 15 min) |
| `POST /api/auth/host/logout` | host | none | `204`, revokes session |
| `POST /api/auth/host/password-reset/request` | none | `{email}` | Always `202` with the same body, whether or not the email has an account and whether or not it was throttled. If the account exists (not deleted), creates a reset token and emails the link after the response is sent |
| `POST /api/auth/host/password-reset/confirm` | none | `{token, newPassword}` | `200` and does **not** log in; sets the new password, marks the token used, ends all of the host's sessions, clears the login lockout. `400` generic for an invalid, expired, or used token or a weak password. If the host's email was unverified it becomes verified |
| `GET /api/host/me` | host | none | `{email, emailVerified}`; the dashboard shows the persistent reminder while `emailVerified` is false |
| `POST /api/auth/host/email-verification/resend` | host | none | `202`. Creates a new 7-day token (older unused ones stop working) and emails the link; refused with `429` past 3 per hour, and `204` no-op if already verified |
| `POST /api/auth/host/email-verification/confirm` | none | `{token}` | `200` and marks the email verified (works from any browser, since the token proves control of the inbox); `400` generic for an invalid, expired, or used token. Never blocks or unblocks any action |

Signup (`POST /api/auth/host/signup`) also creates a verification token and emails the confirmation
link `APP_BASE_URL/verify-email#token=<token>` after the response is sent; signup succeeds even if
the email fails, and the host can resend from the dashboard. Nothing about verification blocks any
route.

The reset link is `APP_BASE_URL/reset-password#token=<token>`. The token sits in the URL fragment so
it is never sent to the server or written to request logs; the page reads it and posts it in the
`confirm` body.

## Guest auth

| Route | Auth | Body | Result |
|---|---|---|---|
| `GET /api/auth/guest/verification/config` | none | none | `{channel, inputType, label}` from the active provider (for example `email`, `email`, "Email address"), so the UI renders the right input without knowing the channel |
| `POST /api/auth/guest/verification/send` | none | `{identifier}` | Always `202` with the same body once the identifier is valid for the channel (`400` otherwise); the code is emailed after the response is sent and is **never** in any response. If an earlier code is still valid and unused this is a **resend**: it does not count against the new-code limit. `429` with `Retry-After` past 5 new codes per identifier per hour, past 10 resends per identifier per hour or within 30 seconds of the last send, or when the daily system-wide verification-email cap is reached (these limits live inside the email provider) |
| `POST /api/auth/guest/verification/confirm` | none | `{identifier, code}` | `200`, finds or creates the guest by `(identifier, channel)` (the identifier is the provider-normalized value, the channel is the configured one), sets cookie; `401` generic on wrong/expired/used/exhausted; `429` when the identifier's attempts across codes in the last hour reach 10 |
| `POST /api/auth/guest/logout` | guest | none | `204` |
| `POST /api/auth/guest/delete` | guest | `{confirm:true}` | `204`, tombstones identity (`identifier`, `channel`, and `verified_at` cleared, name kept), revokes sessions (does not delete media; photos keep displaying unchanged); `400` unless `confirm` is `true`, since the UI first shows the FR-050 confirmation (photos remain and this guest can't delete them afterward unless removed first) |
| `PATCH /api/guest/me` | guest | `{name}` | `200`. Sets or clears the optional display name (1 to 60 characters); `400` if invalid. Never required for verification or upload |

## Host events and moderation

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/host/events` | host | Own events only, each with `closed` state |
| `GET /api/host/events/:eventId/qr` | event host | PNG QR code of the event's current link (`APP_BASE_URL/e/<accessToken>`), shown beside the share link on the host's dashboard; the guest gallery shows no QR |
| `POST /api/host/events` | host | `{name, eventDate}` creates event and owner row, returns `accessToken` |
| `PATCH /api/host/events/:eventId` | event host | Any of: `{name}` rename, `{rotateToken:true}`, `{closed:true}` close, `{closed:false}` reopen |
| `DELETE /api/host/events/:eventId` | event host | Soft delete (restorable until purge) |
| `POST /api/host/events/:eventId/restore` | event host | Restore within grace period |
| `GET /api/host/events/:eventId/reports` | event host | Report queue (open first) with signed thumbnail URLs |
| `PATCH /api/host/reports/:reportId` | event host of the report's event | `{decision:'uphold'\|'dismiss'}`; works on closed events |
| `DELETE /api/host/account` | host | Soft delete account and all events |

## Guest-facing event routes (`:token` = event access token)

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/e/:token` | none | Event name, `closed` flag, the visible-photo `count` (excluding hidden and deleted), and visible media with signed URLs (valid 5 minutes; clients re-request to refresh), plus the caller's verified/consented state and an **`isOwnerHost`** flag (true only when the caller holds a valid host session that owns this event; it switches the gallery and upload pages into owner-host mode). Each media item carries the uploader's display name, or none for anonymous |
| `GET /api/e/:token/media/:mediaId/download` | none | `302` to a 5-minute signed URL that downloads the file (never a public URL), `Cache-Control: no-store`; `404` if the photo is hidden, deleted, or not in this event; works on closed events |
| `POST /api/e/:token/consent` | guest | `{consentVersion}` records consent for this event |
| `POST /api/e/:token/uploads` | host of event, or guest with consent | `{fileName, contentType, byteSize, fileHash?}`. Returns `{intentId, signedUrl}`, or `{duplicate:true}` when the file already exists in the event: `mediaId` is included **only when the matching photo is visible**, and a match against a hidden photo returns `{duplicate:true}` with **no media id**. `409 {code:'event_closed'}` when the event is closed; `429 {code:'upload_limit'}` (with `Retry-After`) when a guest has created 200 upload intents in this event within the last hour. Hosts are not limited. Already-uploaded photos are unaffected |
| `POST /api/e/:token/uploads/:intentId/finalize` | same caller as intent | Server verifies, processes, dedupes. Returns `201 {media, promptForName}` (`promptForName` is true only for a guest whose name is not yet set) or `200 {duplicate:true}` (with `mediaId` only when the existing photo is visible, never for a hidden one); `422` for a non-image or oversize file (temp object removed); `409 {code:'event_closed'}` if the event closed after the upload started (temp object removed, nothing stored) |

Upload rules: identity resolves to exactly one of host or guest; a host acts as host only on
events they own, and at an event they own a host session always resolves as host even if the same browser also holds a guest session; a guest without current-version consent gets `403 {code:'consent_required'}`.

## Media

| Route | Auth | Purpose |
|---|---|---|
| `DELETE /api/media/:mediaId` | the uploader, or the owning host of the event | Soft delete; works on closed events. The owning host may delete any photo in their event, with optional body `{harmful:true}`: open reports on it close as `upheld`, and if `harmful` an evidence report is inserted directly (`upheld`, `harmful`, host as reporter and reviewer, uploader and content hash copied). No email is sent. A deletion not marked harmful creates no report. `403` for a host who does not own the event |
| `POST /api/media/:mediaId/report` | guest | `{reason, note?}`. In one transaction: checks the per-guest limit, inserts the report copying the media's uploader and content hash, and hides the media. `409` if this guest already has an open report on it; `429 {code:'report_limit'}` (with `Retry-After`) when the guest has filed 5 reports in this event within 15 minutes, leaving earlier reports in force. The transaction starts by locking the media row (`SELECT … FOR UPDATE`). `harmful` then emails the event owner and the operator through `after()`, so the response never waits on email (the hide has already committed; an email failure never undoes it, and unsent alerts are retried by the next sweep). Works on closed events |

## Cron

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/cron/sweep` | `Authorization: Bearer $CRON_SECRET` | Idempotent daily maintenance: auto-resolve every report open over 72 hours, retry unsent emails, purge, housekeeping including expired reset tokens ([research.md](../research.md) R12). Each step runs independently; if any step fails the operator gets a sweep-failure email (step name and time only) and the route returns `500`. `401` otherwise |

## VerificationProvider interface (internal contract)

```text
interface VerificationProvider {
  send(identifier: string): Promise<void>                               // never returns or logs the code
  verify(identifier: string, code: string): Promise<{ identifier: string } | null>
}
```

**Exactly two operations.** The channel is configuration (`VERIFICATION_CHANNEL`, `email` for now), not
an interface member. Each provider validates and normalizes identifiers of its own channel internally,
and signals problems with typed errors (invalid identifier, rate limited with a retry-after) that routes
map to `400` and `429`. `verify` returns the normalized identifier on success, which the confirm route
uses with the configured channel to find or create the guest by `(identifier, channel)`. The active
implementation is `EmailOtpProvider`: it generates a 6-digit code, stores its HMAC in `otp_codes`,
applies its own throttles, and emails the code through the Mailer with `after()`. Per-channel UI hints
(`inputType`, `label`) live beside the provider registration in `lib/verification/index.ts` and are
served by the config route. Routes and the rest of the system depend only on this interface and on
`guest_id`. Consent, `event_guests`, media, reports, and sessions already key off `guest_id` and need no
change for any channel. A future phone channel is one new provider plus configuration, with new guest
rows where `channel = 'phone'` and no migration.

## Mailer interface (internal contract)

```text
interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>   // throws on failure
}
```

Callers always send through Next.js `after()`, never awaiting it in the response. Resolved by `lib/notify/index.ts` from `MAIL_PROVIDER` (`gmail` or, for local use only, `console`).
Used for guest verification codes, the harmful-report alert, the auto-hold digest, the password-reset and email-verification links, and the sweep-failure alert. Implementations
never log message bodies or credentials.
