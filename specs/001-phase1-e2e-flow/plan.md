# Implementation Plan: Phase 1 - Single-User End-to-End Flow

**Branch**: `001-phase1-e2e-flow` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-phase1-e2e-flow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Deliver the full Phase 1 loop — host creates one event with a PIN, gets a QR code linking to
an upload page, a guest uploads photos directly from their phone, and a gallery page shows all
photos with a count — as a single Next.js (App Router) app deployed on Vercel. All
server-side logic (event creation, PIN check, signed upload URL issuance, gallery/photo
listing) runs in Next.js API routes / Server Actions using raw SQL (`pg`) against Supabase
Postgres. Photo bytes never pass through the Next.js server: the browser uploads directly to
Supabase Storage via a presigned URL to avoid Vercel's 4.5MB payload limit.

## Technical Context

**Language/Version**: TypeScript, Next.js (App Router), Node.js runtime on Vercel

**Primary Dependencies**: `next`, `react`, `pg` (raw SQL, no ORM), `qrcode` (QR generation),
`@supabase/supabase-js` (Storage client only, for presigned upload URLs — Data API stays
disabled), Tailwind CSS, shadcn/ui

**Storage**: Postgres (hosted on Supabase, direct `pg` connection string, Data API disabled)
for `events`/`photos` metadata; Supabase Storage for photo files

**Testing**: Manual quickstart validation on a real deployed URL from a real phone for this
phase (per spec FR-011); no automated test framework introduced yet — flagged as an open
question below since the constitution and spec do not mandate one

**Target Platform**: Web (mobile browser for guests/host), server-side Next.js on Vercel

**Project Type**: Web application — single Next.js project (frontend + API routes together,
per Constitution Principle III)

**Performance Goals**: No specific throughput target (single event, single host, low
concurrency per Constitution Principle II); uploads should complete promptly on typical mobile
network conditions

**Constraints**: Photo uploads MUST NOT pass through a Next.js API route body (Vercel 4.5MB
serverless payload limit) — browser uploads directly to Supabase Storage using a presigned
URL; no ORM (Constitution Principle IV); no queue/background jobs/realtime (Constitution
Principle V); no auth system beyond PIN check (Constitution Principle I)

**Scale/Scope**: One event, one host, one or more guests uploading a handful of photos each,
per Constitution Principles I and II — not designed for concurrent-upload scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Single Event, Single Host** — PASS. Design has exactly one `events` row expected in
  practice (schema does not prevent more, but no multi-event UI/routing is built); PIN is the
  only host auth.
- **II. YAGNI / Build for the Users We Have** — PASS. No caching, no rate limiting, no
  pagination, no multi-uploader concurrency handling beyond what's needed for one guest at a
  time, per spec's explicit out-of-scope list.
- **III. One Application, No Separate Services** — PASS. Single Next.js app; API
  routes/Server Actions handle all server logic; no standalone backend.
- **IV. Raw SQL, No ORM** — PASS. All Postgres access via `pg` with hand-written SQL.
  `@supabase/supabase-js` is used strictly for Storage (presigned URLs), not as a database
  client/ORM.
- **V. Synchronous by Default** — PASS. Event creation, QR generation, presigned URL issuance,
  and gallery listing are all synchronous request/response; no queue or background job.
- **VI. Open Access, No Gating** — PASS. No payment/tier/threshold gating; anyone with the
  link sees the full gallery.
- **VII. Server-Only Data Access** — PASS. Browser never talks to Postgres. Browser does talk
  directly to Supabase Storage for the upload itself (not the Data API, and not Postgres) —
  this is an explicit, scoped exception requested to work around Vercel's payload limit; see
  Complexity Tracking.

Initial gate result: **PASS** (one documented, justified exception — see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-phase1-e2e-flow/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── page.tsx                          # Host: create/view event form
├── e/[eventId]/
│   ├── upload/page.tsx               # Guest: upload page (no login)
│   └── gallery/page.tsx              # Guest/host: gallery page with count
└── api/
    ├── events/route.ts               # POST create event (sets host session cookie), verify-pin sub-route
    ├── events/[eventId]/upload-url/route.ts  # POST issue presigned Storage upload URL
    ├── events/[eventId]/photos/route.ts      # POST record photo after upload, GET list photos
    └── events/[eventId]/qr/route.ts   # GET QR code (host-only, requires session cookie)

lib/
├── db.ts                             # pg Pool + query helper (raw SQL only)
├── storage.ts                        # Supabase Storage client, presigned URL helper
└── qr.ts                             # qrcode wrapper for generating upload-page QR codes

db/
└── migrations/
    └── 001_init.sql                  # events + photos table definitions

components/                           # shadcn/ui components + Tailwind config/global CSS,
                                       # applied in Setup before any page-building task
```

**Structure Decision**: Single Next.js App Router project (Constitution Principle III — no
separate backend/frontend split). Routes are grouped by the three user stories: `app/page.tsx`
(host create/view, US1), `app/e/[eventId]/upload` (guest upload, US2), and
`app/e/[eventId]/gallery` (gallery + count, US3). All database and storage access is isolated
in `lib/db.ts` and `lib/storage.ts` so API routes stay thin and no component ever imports `pg`
or a service-role Storage key directly.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Browser uploads photo bytes directly to Supabase Storage (bypasses Principle VII's "server-only data access" for this one write path) | Vercel serverless functions cap request bodies at 4.5MB; ordinary phone photos routinely exceed this, so routing the file through a Next.js API route would fail for real-world uploads | Proxying the upload through an API route was rejected because it cannot work within Vercel's payload limit for this phase's real-device requirement (spec FR-011); the API route still owns issuing the presigned URL and recording the resulting path, so Postgres itself is never touched by the browser |
