# Feature Specification: Phase 1 - Single-User End-to-End Flow

**Feature Branch**: `001-phase1-e2e-flow`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Build Phase 1 of Memento: an end-to-end flow for a single user. Goal: I create an event, get a QR code for it, scan that QR code myself, upload a photo, and see it appear in a shared gallery. This is the whole loop working for one person, deployed for real — not local-only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host creates an event and gets a shareable QR code (Priority: P1)

A host sets up their wedding event by giving it a name and date, and protects host actions
with a simple PIN. Once created, the host receives a QR code (and underlying link) that
points guests to that event's shared gallery page, which includes the guest upload action —
there is no separate upload-only page. The host can also share the gallery link via the Web
Share API (native share sheet on mobile) or a fallback "copy link" button.

**Why this priority**: Nothing else in the loop can happen without an event existing and a
way to share access to it. This is the foundation the rest of the flow depends on.

**Independent Test**: Can be fully tested by creating an event with a name, date, and PIN, and
verifying a QR code / link is generated that resolves to that event's gallery page; verify
the host can share the link via a share button.

**Acceptance Scenarios**:

1. **Given** no event exists yet, **When** the host submits a name, date, and PIN to create an
   event, **Then** the event is created and a QR code linking to the event's gallery page is
   displayed, along with a share button.
2. **Given** an event already exists, **When** the host views the event again using the
   correct PIN, **Then** the host can see the event details, the same QR code / link, and a
   share button.
3. **Given** the host is viewing their event, **When** they tap the share button on a
   mobile browser with Web Share API support, **Then** a native share sheet appears.
4. **Given** the host is viewing their event on a browser without Web Share API support,
   **When** they tap the share button, **Then** a "copy link" action is available (e.g., a
   tooltip or modal with a copy-to-clipboard button).
5. **Given** an event exists, **When** someone provides an incorrect PIN for host actions,
   **Then** access to host-only actions is denied.

---

### User Story 2 - Guest scans the QR code and uploads photos (Priority: P2)

A guest, with no account and no app, scans the event's QR code with their phone camera and
lands directly on the event's shared gallery page — the same page anyone with the link sees —
which includes an "Upload memories" action. They choose one or more photos from their phone's
photo library (or take a new one with their camera) and upload them without any login step.

**Why this priority**: This is the core value delivery of the product — getting a photo from
a guest's phone into the shared collection. It depends on User Story 1 (an event and its QR
code must already exist) but is independently testable once a valid event link exists.

**Independent Test**: Can be fully tested by opening the event's gallery link directly on
a phone (simulating a QR scan), using the upload action to choose one or more photos from the
photo library, submitting the upload, and verifying the photos are stored and linked to the
correct event.

**Acceptance Scenarios**:

1. **Given** a valid event link, **When** a guest opens it on their phone, **Then** they land
   on the shared gallery page with an "Upload memories" action, and no login or account
   prompt.
2. **Given** the guest opens the upload action, **When** they choose one photo from their
   phone's photo library and submit, **Then** the photo is uploaded and associated with that
   event.
3. **Given** the guest opens the upload action, **When** they choose multiple photos from
   their photo library in one session and submit, **Then** all selected photos are uploaded
   and associated with that event.
4. **Given** the guest selects a non-image file, **When** they attempt to upload it, **Then**
   the system rejects the file and explains that only photos are accepted.

---

### User Story 3 - View the shared gallery (Priority: P3)

Anyone with the event link can open the shared gallery page that shows every photo uploaded
for the event so far, along with a simple count of total photos. This is the same page the
upload action lives on (User Story 2) — there is no separate view-only page. Each photo in
the gallery can be downloaded as a file, and can be viewed full-size in a lightbox with the
ability to scroll between photos.

**Why this priority**: This closes the loop and delivers the visible payoff of the feature,
but it depends on at least one photo having been uploaded (User Story 2) to be meaningful.

**Independent Test**: Can be fully tested by uploading one or more photos for an event, then
opening the gallery page and confirming every uploaded photo is visible along with an
accurate count; verify each photo can be downloaded and viewed full-size with navigation
between photos.

**Acceptance Scenarios**:

1. **Given** an event with no photos uploaded yet, **When** the gallery page is opened,
   **Then** it shows zero photos and a count of 0.
2. **Given** an event with one or more photos uploaded, **When** the gallery page is opened,
   **Then** every uploaded photo is visible and the displayed count matches the actual number
   of photos.
3. **Given** the gallery is already open, **When** a new photo is uploaded and the page is
   manually refreshed, **Then** the new photo appears and the count updates accordingly.
4. **Given** a photo is visible in the gallery, **When** the user clicks/taps on it, **Then**
   it opens in a full-screen lightbox view.
5. **Given** a photo is open in the lightbox, **When** the user swipes left/right (on mobile)
   or uses arrow keys (on desktop), **Then** the view transitions to the previous/next photo
   in the gallery.
6. **Given** a photo is visible in the gallery (thumbnail or lightbox), **When** the user
   initiates a download (e.g., via a download button or long-press), **Then** the photo is
   downloaded to their device as a file.

---

### Edge Cases

- What happens when a guest's upload is interrupted (e.g., lost connection) partway through?
  The system should not show a partially-uploaded or corrupted photo in the gallery.
- What happens if the host enters the wrong PIN repeatedly? Host actions remain blocked; no
  guest-facing behavior is affected.
- What happens if a guest scans the QR code before any host has finished creating the event?
  The link should not exist yet, so this is only possible after event creation completes.
- How does the system handle a guest uploading a very large photo file from their phone? The
  upload should either succeed or fail with a clear message; it must not silently drop the
  photo.
- What happens if the gallery is opened for an event that does not exist (e.g., bad link)?
  The guest should see a clear "not found" state rather than an error page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a host to create one event with a name and a date.
- **FR-002**: System MUST require a PIN, set at event creation, to authenticate host-only
  actions for that event (e.g., viewing/regenerating the QR code).
- **FR-003**: System MUST generate a QR code that encodes a link directly to the event's
  gallery page, which includes the guest upload action (not a separate upload-only page).
- **FR-004**: System MUST allow any guest who opens the gallery link to access the gallery
  page and its upload action without creating an account or logging in.
- **FR-005**: Guests MUST be able to choose one or more photos — from their phone's existing
  photo library, not only by taking a new photo with the camera — and upload them in a single
  upload action from a mobile browser.
- **FR-006**: System MUST validate that uploaded files are photos and reject non-image files
  with a clear message.
- **FR-007**: System MUST persist every successfully uploaded photo and associate it with the
  specific event it was uploaded to.
- **FR-008**: System MUST provide a gallery page that lists every photo uploaded for an event.
- **FR-009**: The gallery page MUST display a count of the total number of photos uploaded for
  the event.
- **FR-010**: The gallery page MUST reflect newly uploaded photos after a manual page refresh
  (no automatic/live update required in this phase).
- **FR-011**: The entire flow — event creation, QR code generation, guest upload, and gallery
  viewing — MUST work end-to-end on a publicly accessible deployed URL, accessible from a real
  phone, not only in a local development environment.
- **FR-012**: System MUST NOT require guests to install an app, create an account, or log in
  at any point in the upload or gallery-viewing flow.
- **FR-013**: System MUST provide a share button on the host's event page that uses the Web
  Share API (navigator.share) when available; on browsers without Web Share API support, the
  button MUST offer a "copy link to clipboard" fallback.
- **FR-014**: Every photo in the gallery MUST be individually downloadable as a file; download
  links MUST use the public photo URL (no authentication required).
- **FR-015**: Photos in the gallery MUST be viewable full-size (lightbox) when clicked/tapped;
  when open, the lightbox MUST support navigation between photos (swipe or arrow keys) without
  requiring a page reload.

### Key Entities *(include if feature involves data)*

- **Event**: Represents the single wedding event for this phase. Key attributes: name, date,
  host PIN, and a unique identifier used to build the upload/gallery links.
- **Photo**: Represents a single uploaded image. Key attributes: the image file itself, the
  event it belongs to, and the time it was uploaded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A host can go from starting event creation to seeing a working QR code in under
  2 minutes.
- **SC-002**: A guest can go from scanning the QR code to seeing their uploaded photo appear in
  the gallery (after a manual refresh) in under 3 minutes.
- **SC-003**: 100% of photos that complete the upload step successfully appear in the gallery
  and are counted accurately.
- **SC-004**: The complete loop — create event, scan QR, upload a photo, view it in the
  gallery — can be performed entirely on a real phone against the live deployed URL, with no
  developer/manual intervention required.

## Assumptions

- This phase serves exactly one event and one host, consistent with the project's
  single-event, single-host model; no multi-event or multi-tenant behavior is included.
- The host's PIN is remembered for the duration of their browser session after being entered
  once, so they are not re-prompted on every host action within that session.
- Standard phone photo formats (e.g., JPEG, PNG, HEIC) are acceptable; no specific file size
  cap is defined for this phase beyond rejecting clearly non-image files.
- No image resizing, compression, or thumbnail generation is required in this phase — the
  gallery may display uploaded photos as-is.
- No retention or deletion policy is required in this phase; uploaded photos persist
  indefinitely.
- The gallery does not require real-time/live updates; a manual page refresh to see new
  photos is sufficient, per explicit scope.
- The guest-facing upload action lives on the same gallery page guests land on from the QR
  code (a modal/dialog on that page), rather than a separate upload-only page — this matches
  the intended visual design and avoids a redundant hop for guests who scan the link.
- The photo file picker MUST let guests choose existing photos from their library, not force
  the camera open directly — forcing the camera (e.g., via the HTML `capture` attribute) is
  explicitly avoided since it prevents uploading already-taken photos.
- Supabase Storage bucket MUST be configured as public (no auth required to read) to support
  direct download links for photos (FR-014). Photo storage paths use random UUIDs and are
  only revealed via authenticated API (to the event), so public bucket access does not expose
  unintended photos.
- The lightbox (FR-015) is a UI-only feature; no new backend endpoints or schema changes are
  required — it displays the same photos and URLs already provided by the gallery page.
- The Web Share API fallback (FR-013) is client-side only; no new endpoints needed — it shares
  the `galleryUrl` returned from the event creation or QR endpoints.
- The deployed URL is publicly accessible over HTTPS, consistent with the project's Vercel
  deployment model.
