# Phase 0 Research: Phase 1 - Single-User End-to-End Flow

## 1. Direct browser-to-Storage upload pattern

**Decision**: Use Supabase Storage's signed upload URL (`createSignedUploadUrl`) issued by a
Next.js API route, then have the browser `PUT`/upload directly to that URL. The API route
never receives the photo bytes.

**Rationale**: Vercel serverless functions enforce a 4.5MB request body limit. Ordinary phone
photos (especially from modern iPhones/Android cameras) routinely exceed this. A presigned
upload URL lets the browser talk directly to Supabase Storage's own endpoint, sidestepping the
Vercel limit entirely while keeping the Next.js API route as the single authority for
deciding *where* a file may be written (it generates the destination path and the signed
token).

**Alternatives considered**:
- Proxy the upload through an API route (`multipart/form-data` body) — rejected: fails for
  files near/over 4.5MB, which is a real, expected case for phone photos.
- Client uploads with a public/anon Storage bucket and no signed URL — rejected: would allow
  anyone to write directly to the bucket without going through event-specific validation,
  weakening the "photo must be associated with a real event" guarantee.

## 2. Database access pattern (raw SQL, no ORM)

**Decision**: A single shared `pg.Pool` instance in `lib/db.ts`, exporting a small `query()`
helper. All API routes/Server Actions call parameterized SQL directly (e.g.,
`query('SELECT * FROM events WHERE id = $1', [eventId])`).

**Rationale**: Constitution Principle IV is non-negotiable — raw SQL via `pg`, no ORM. A
pooled connection is the standard, minimal-complexity way to talk to Postgres from Next.js
serverless functions without reintroducing an abstraction layer.

**Alternatives considered**:
- Prisma/Drizzle — rejected outright per constitution.
- Per-request `new Client()` connections — rejected: unnecessary overhead vs. a shared pool;
  pooling is a standard `pg` practice, not an added abstraction.

## 3. QR code generation

**Decision**: Use the `qrcode` npm package server-side (in an API route or at event-creation
time) to generate a QR code (as a data URL or PNG) encoding the absolute URL to
`/e/[eventId]/upload`.

**Rationale**: Matches the explicit technical direction; `qrcode` is a small, dependency-light
library with no server infrastructure requirements, consistent with Constitution Principle II
(no unnecessary infrastructure).

**Alternatives considered**:
- Third-party QR API/service — rejected: adds an external network dependency for something a
  small local library does synchronously and for free.

## 4. Host PIN authentication

**Decision**: PIN is stored on the `events` row (as plain value for this phase, given single
low-stakes event and explicit constitution scope — flagged as an open question below) and
checked server-side on host actions. On success, a short-lived session cookie/token scoped to
that event is set so the host isn't re-prompted for the rest of the browser session. Event
creation (`POST /api/events`) also sets this cookie immediately, since the host has just
supplied the PIN — they should not need a redundant `verify-pin` round-trip right after
creating the event. Every other host-only action (e.g., `GET /api/events/{eventId}/qr`)
requires this cookie and returns `401` if it is missing/invalid.

**Rationale**: Constitution Principle I explicitly limits auth to "a single PIN-based host
session" — no accounts, no roles beyond host/guest. A cookie set after a successful PIN check
is the simplest mechanism that satisfies "entered once, remembered for the session" without
introducing a general auth system.

**Alternatives considered**:
- Full session/auth library (e.g., NextAuth) — rejected: unnecessary infrastructure for a
  single PIN check (Constitution Principle II).
- Re-checking PIN on every host request with no session persistence — rejected: contradicts
  the "not re-prompted every action" assumption documented in the spec.

**Open question (not blocking)**: Whether the PIN should be hashed at rest in `events.pin`.
The spec and constitution do not mandate this, and the threat model is a single low-stakes
private event; storing it hashed is a cheap, low-risk improvement worth doing in
implementation even though not strictly required — noted for the plan's data model, not left
as a spec-level `NEEDS CLARIFICATION`.

## 5. Testing approach

**Decision**: This phase relies on the manual quickstart validation flow (see
`quickstart.md`) performed on a real deployed URL from a real phone, per spec FR-011 and
SC-004. No automated test framework is introduced in this phase.

**Rationale**: Constitution Principle II (YAGNI) — introducing a full automated testing setup
(e.g., Playwright, Vitest) is not requested by the spec or technical direction and isn't a
currently observed need; the spec's own success criteria are phrased as manual, real-device
validation.

**Alternatives considered**:
- Full E2E test suite (Playwright) — deferred, not rejected permanently; flagged as a
  candidate for a later phase if regressions become a real, observed problem.
