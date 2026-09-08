---

description: "Task list for Phase 1 - Single-User End-to-End Flow"
---

# Tasks: Phase 1 - Single-User End-to-End Flow

**Input**: Design documents from `/specs/001-phase1-e2e-flow/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested in the feature spec or technical direction — no automated test tasks are included (see research.md §5). Validation is manual, via quickstart.md, on a real deployed URL.

**Organization**: Tasks are grouped by user story (US1 = host creates event + QR, US2 = guest upload, US3 = gallery) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths follow the single Next.js App Router project structure defined in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and the real visual design system —
applied up front so every page built in later phases uses the actual theme, not placeholder
styling.

- [X] T001 Create the Next.js App Router project structure per plan.md (`app/`, `lib/`, `db/migrations/`, `components/`)
- [X] T002 Install dependencies: `next`, `react`, `pg`, `qrcode`, `@supabase/supabase-js`, `tailwindcss`, shadcn/ui CLI and its peer packages
- [X] T003 [P] Add `.env.example` documenting required environment variables (Supabase Postgres connection string, Supabase project URL, Storage key) with no real values committed
- [X] T004 Apply the prepared visual theme into the project: copy the existing Tailwind config, `app/globals.css`, and shadcn/ui components into `components/` and the app root, so subsequent pages are built directly against the real design system instead of plain markup

**Checkpoint**: Design system and tooling are in place before any page or API work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data-access infrastructure that MUST exist before any user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Write `db/migrations/001_init.sql` defining `events` and `photos` tables per data-model.md
- [X] T006 [P] Implement `lib/db.ts`: shared `pg.Pool` and a parameterized `query()` helper (raw SQL only, no ORM)
- [X] T007 [P] Implement `lib/storage.ts`: Supabase Storage client plus a helper to create signed upload URLs
- [X] T008 [P] Implement `lib/qr.ts`: wrapper around the `qrcode` package to generate a QR code for a given upload URL
- [X] T009 Implement a shared host-session helper (e.g., `lib/session.ts`) to set, read, and verify the event-scoped PIN session cookie, used by event creation, verify-pin, and the QR route

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Host creates an event and gets a shareable QR code (Priority: P1) 🎯 MVP

**Goal**: Host submits a name, date, and PIN; an event is created, a host session is
established, and a QR code linking to the event's gallery page is available on demand.

**Independent Test**: Create an event with a name, date, and PIN, and verify a QR code/link is
generated that resolves to that event's gallery page; verify an incorrect PIN is rejected for
host-only actions.

### Implementation for User Story 1

- [X] T010 [US1] Implement `POST /api/events` in `app/api/events/route.ts`: validate input, store the event (PIN persisted per data-model.md), and set the host session cookie on success
- [X] T011 [US1] Implement `POST /api/events/{eventId}/verify-pin` in `app/api/events/[eventId]/verify-pin/route.ts`: check PIN against the stored event, set the session cookie on success, return 401 on mismatch
- [X] T012 [US1] Implement `GET /api/events/{eventId}/qr` in `app/api/events/[eventId]/qr/route.ts`: require a valid host session cookie (401 if missing/invalid), otherwise return a QR code encoding the event's gallery URL
- [X] T013 [US1] Build the host create/view event page in `app/page.tsx` using the design system from Phase 1 (name/date/PIN form, QR code display, gallery link)
- [X] T014 [US1] Add input validation and error messaging for event creation (missing/invalid name, date, or PIN)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — an event can be created and its QR code retrieved by an authenticated host.

---

## Phase 4: User Story 2 - Guest scans the QR code and uploads photos (Priority: P2)

**Goal**: A guest opens the event's gallery page with no login, uses its "Upload memories"
action to choose one or more photos from their photo library, and they are uploaded directly
to Storage and recorded against the event.

**Independent Test**: Open the event's gallery link directly on a phone, use the upload
action to choose one or more photos from the photo library, submit, and verify the photos are
stored and linked to the correct event; verify a non-image file is rejected.

### Implementation for User Story 2

- [X] T015 [US2] Implement `POST /api/events/{eventId}/upload-url` in `app/api/events/[eventId]/upload-url/route.ts`: validate `contentType` is an image type, return a presigned Storage upload URL and generated `storagePath`
- [X] T016 [US2] Implement `POST /api/events/{eventId}/photos` in `app/api/events/[eventId]/photos/route.ts`: record a photo row for `storagePath` only after the client confirms the direct Storage upload succeeded
- [X] T017 [US2] Build the guest upload action as a modal/dialog on `app/e/[eventId]/gallery/page.tsx` (not a separate upload-only page): file picker supporting multi-select from the photo library (no `capture` attribute forcing the camera), calls `upload-url` then uploads directly to Storage, then calls `photos` to record each success and refreshes the gallery
- [X] T018 [US2] Add a "not found" state on the gallery page for an invalid/nonexistent `eventId`
- [X] T019 [US2] Add client-side and server-side rejection of non-image file selections with a clear message

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently — an event can be created and a guest can upload photos to it via the QR link.

---

## Phase 5: User Story 3 - View the shared gallery (Priority: P3)

**Goal**: Anyone with the event link can see every uploaded photo and an accurate total count.

**Independent Test**: Upload one or more photos for an event, open the gallery page, and
confirm every uploaded photo is visible along with an accurate count; confirm a zero-photo
event shows a count of 0.

### Implementation for User Story 3

- [X] T020 [US3] Implement `GET /api/events/{eventId}/photos` in `app/api/events/[eventId]/photos/route.ts`: list all photos for the event, most recent first, with a total count
- [X] T021 [US3] Build the gallery page in `app/e/[eventId]/gallery/page.tsx` using the design system: photo grid, count, "Upload memories" action (see T017), and manual refresh to see new uploads
- [X] T022 [US3] Add a "not found" state on the gallery page for an invalid/nonexistent `eventId`

**Checkpoint**: All user stories should now be independently functional — the full create → QR → upload → gallery loop works end to end.

---

## Phase 6.5: Bug Fixes (post-quickstart, real-phone testing)

**Purpose**: Fixes found during real-device quickstart testing, not caught by build/lint alone

- [X] T026 Disable Vercel Deployment Protection (Vercel Authentication) on the project so guests scanning the QR code aren't forced through a Vercel login (dashboard setting, not code)
- [X] T027 Point the QR code and guest-facing link at the gallery page instead of a separate upload-only page, matching the intended combined gallery+upload design
- [X] T028 Remove the `capture="environment"` attribute from the photo file input so guests can choose existing photos from their library, not only take a new one with the camera
- [X] T029 Ensure there is always a way back to (or straight onto) the gallery after a successful upload — solved by T027 (guest is already on the gallery) plus a "View gallery" link on the standalone `app/e/[eventId]/upload` fallback page

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final checks that span all user stories

- [X] T023 [P] Document required environment variables and setup steps in `README.md` (Supabase connection string, Storage credentials) without hardcoding any values
- [ ] T024 Deploy to Vercel connected to the GitHub `main` branch and confirm auto-deploy on push
- [ ] T025 Run the full [quickstart.md](./quickstart.md) validation end-to-end on a real deployed URL from a real phone

---

## Phase 7: Enhanced User Experience (Share, Download, Lightbox)

**Purpose**: Add three capability enhancements for Phase 1: share button for hosts, individual photo download, and full-size lightbox viewer with carousel navigation.

**No schema or backend endpoints required**: All three features use existing data structures and APIs.

### Implementation for Share & Download & Lightbox

- [ ] T030 [P] Add a "Share" button on the host event page (`app/page.tsx` after event creation) that uses `navigator.share()` to open a native share sheet on supported mobile browsers (iOS/Android); provide a "copy link to clipboard" fallback for desktop/unsupported browsers. Share the `galleryUrl` returned by the event creation response. This is client-side only (no new endpoints needed). Reference: Web Share API MDN, clipboard API for fallback.
- [ ] T031 [P] Add an individual download link/button for each photo in the gallery grid (in `app/e/[eventId]/gallery/page.tsx`). The download link uses the public photo URL already returned by `GET /api/events/{eventId}/photos`, with an HTML `<a href={url} download>` attribute (no new backend endpoint needed). Ensure the link works for users with JavaScript disabled.
- [ ] T032 [P] Implement a lightbox viewer in `app/e/[eventId]/gallery/page.tsx`: when a photo thumbnail is clicked, open a full-screen modal showing the photo at larger size, and allow navigation to previous/next photos via arrow keys (on desktop) or swipe gestures (on mobile) without reloading the page. Use existing shadcn/ui Dialog component as the modal container. No new API calls or schema changes required.

**Checkpoint**: All three enhancements are purely frontend — they integrate the existing gallery page with Web APIs and client-side interactivity, increasing usability without requiring backend changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. Includes applying the design system, which MUST complete before any page-building task in Phases 3-5.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2/US3.
  - US2 (Phase 4) depends on an existing event (US1) to have something to upload against, but its implementation (API routes, upload page) is independently buildable once Phase 2 is done.
  - US3 (Phase 5) depends on photos existing (US2) to be meaningful, but its implementation is independently buildable once Phase 2 is done.
- **Polish (Phase 6)**: Depends on all user stories being complete.
- **Enhancements (Phase 7)**: Depends on all user stories being complete (Phase 6); all three tasks (T030/T031/T032) are independent of each other and can run in parallel.

### Within Each User Story

- API routes before the page that calls them.
- Story complete and independently testable before moving to the next priority.

### Parallel Opportunities

- T003 and T004 in Setup can run in parallel with each other (different files) but both must finish before Phase 3 page work starts.
- T006, T007, T008 in Foundational can run in parallel (different files).
- Once Phase 2 is complete, US1, US2, and US3 API-route tasks can be developed in parallel by different contributors, though the pages in US2/US3 are most meaningfully tested after US1/US2 exist.
- T030, T031, T032 in Phase 7 can all run in parallel (no dependencies between them) as long as Phase 5 gallery page is complete.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (including the real design system).
2. Complete Phase 2: Foundational (blocking).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Confirm an event can be created and its QR code retrieved, styled with the real design system.

### Incremental Delivery

1. Setup + Foundational → Phase 3 (US1) → validate → deploy.
2. Add Phase 4 (US2) → validate the full create-to-upload loop → deploy.
3. Add Phase 5 (US3) → validate the full create-to-upload-to-gallery loop → deploy.
4. Phase 6 polish → run full quickstart.md on the live deployed URL from a real phone.
