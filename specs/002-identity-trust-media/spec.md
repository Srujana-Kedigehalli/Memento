# Feature Specification: Identity, Trust & Media Handling

**Feature Branch**: `002-identity-trust-media`

**Created**: 2026-09-30

**Status**: Draft (amended 2026-09-30)

**Input**: User description: "Build Memento's identity, trust, and media-handling layer: real accounts for both hosts and guests, media upload with integrity checks, and a reporting/moderation flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host account and multiple events (Priority: P1)

A host signs up with an email and password, logs in later, and can create more than one event under the same account. The host sees only their own events and can manage each one. A host who forgets their password can reset it through their account email. A host can close an event to stop new uploads while the existing photos stay viewable. After signup a host is sent a confirmation link to verify their email; verifying is encouraged by a persistent reminder but never blocks anything.

**Why this priority**: Every other capability hangs off a verified host and an event they own. Without it nothing else can be tested. Password reset matters here because the host's email is also where harmful-report alerts go, so it must be genuinely recoverable.

**Independent Test**: Sign up two separate hosts, have each create two events, and confirm each host sees only their own two events. Reset one host's password, and close one event and confirm uploads stop while viewing continues. Sign up, confirm the dashboard shows an unverified reminder while every action still works, then follow the emailed link and confirm the reminder disappears.

**Acceptance Scenarios**:

1. **Given** no account exists for an email, **When** a visitor signs up with that email and a valid password, **Then** an account is created and the host is logged in.
2. **Given** a logged-in host, **When** they create a second event, **Then** both events appear in their event list.
3. **Given** two hosts each with events, **When** either logs in, **Then** they see only their own events and cannot open the other's event management pages.
4. **Given** an existing account, **When** someone logs in with a wrong password, **Then** access is refused with a generic message that does not reveal whether the email exists.
5. **Given** a host who forgot their password, **When** they request a reset for their account email, **Then** a single-use, time-limited reset link is sent to that email.
6. **Given** a valid reset link, **When** the host sets a new password that meets the strength rules, **Then** the password changes, every existing login session for that account ends, and the host can log in with the new password.
7. **Given** a reset request for an email that has no account, **When** submitted, **Then** the response is identical to a successful request and no email reveals whether the account exists.
8. **Given** an expired, already-used, or invalid reset link, **When** it is opened, **Then** the password is not changed and the host is told to request a new link.
9. **Given** a logged-in host who owns an open event, **When** they close it, **Then** no one (including the host) can add new photos to it, and everyone with the link can still view its visible photos.
10. **Given** a closed event, **When** a guest or the host tries to upload, **Then** the attempt is refused with a clear message that the event is closed and nothing is stored.
11. **Given** a closed event, **When** the host reopens it, **Then** uploads are accepted again.
12. **Given** an upload that was started before the event was closed, **When** it finishes after the close, **Then** it is refused and nothing is stored.
13. **Given** a host who does not own an event, **When** they try to close or reopen it, **Then** access is refused.
14. **Given** a visitor who has just signed up, **When** the account is created, **Then** a confirmation link is sent to their email and they can use the product immediately without following it.
15. **Given** a host whose email is not yet verified, **When** they open their dashboard, **Then** a persistent reminder is shown, and they can still create events, upload, review reports, and do everything else.
16. **Given** a valid confirmation link, **When** the host follows it, **Then** their email is marked verified and the reminder disappears.
17. **Given** an expired, already-used, or invalid confirmation link, **When** it is opened, **Then** nothing changes and the host is told they can request a new link from their dashboard; the number of new-link requests is limited.

---

### User Story 2 - Guest email verification that persists across events (Priority: P1)

A guest who wants to upload or report verifies their identifier with a one-time code sent through the configured channel. Today that channel is email, so the identifier is their email address; the channel can change later without changing anything else about how guests work. They do this once. When they later join a second, different event, they are already recognized and are not asked to verify again. Viewing an event never requires verification.

**Why this priority**: Every upload and every report must be traceable to a verified identity; this is the trust foundation.

**Independent Test**: Verify a guest at event A, then open event B's link on the same device and upload without re-verifying.

**Acceptance Scenarios**:

1. **Given** an unverified visitor with an event link, **When** they open the gallery, **Then** they can view all visible photos without verifying.
2. **Given** an unverified visitor, **When** they try to upload or report, **Then** they are asked to verify their identifier (currently their email address) with a one-time code first.
3. **Given** a correct code entered within its validity period, **When** submitted, **Then** the guest is verified and returned to what they were doing.
4. **Given** an incorrect, expired, or already-used code, **When** submitted, **Then** verification fails and no session is created.
5. **Given** a verified guest at event A, **When** they open event B, **Then** they are recognized without another code.
6. **Given** repeated failed or excessive code requests for one identifier, **When** a limit is reached, **Then** further attempts are temporarily blocked.
7. **Given** verification codes are being requested for many different identifiers across the system, **When** the system's generous daily limit is reached, **Then** further requests are refused temporarily with a clear message, and safety alerts to hosts and the operator are unaffected.
8. **Given** a guest whose code has not arrived, **When** they ask for it to be sent again while their previous code is still valid and unused, **Then** a code is sent again and this does not use up their limit on new codes the way a new request does.
9. **Given** someone repeatedly requesting codes for another person's address, **When** the real guest then asks for a code while an earlier code is still valid, **Then** they still get one and can verify.

---

### User Story 3 - Per-event consent before a guest's first upload (Priority: P1)

Before a guest's first upload in a given event, they see a disclosure describing who can see photos in that specific event and must agree. Consent is recorded per event; agreeing at one event does not carry to another.

**Why this priority**: The disclosure is about that event's specific audience, so consent cannot be reused across events.

**Independent Test**: A verified guest tries to upload at event A (prompted, consents, uploads), then at event B (prompted again).

**Acceptance Scenarios**:

1. **Given** a verified guest with no consent recorded for this event, **When** they attempt to upload, **Then** the event-specific disclosure is shown and the upload is blocked until they agree.
2. **Given** a guest who consented at this event, **When** they upload again, **Then** they are not prompted again.
3. **Given** a guest who consented at event A, **When** they attempt to upload at event B, **Then** they are prompted for event B's consent.
4. **Given** a guest who declines, **When** they decline, **Then** nothing is uploaded and they can still view the gallery.

---

### User Story 4 - Upload with integrity checks and safe processing (Priority: P1)

A host or a verified, consenting guest uploads a photo to an event. The system checks the file itself (not the client's claims), rejects an exact duplicate of a photo already in that event, and prepares the photo for display: hidden metadata such as location is removed, the image is converted to a widely-supported format, and a thumbnail is created. Every photo is attributed to exactly one uploader: either a host or a guest, never neither and never both.

**Why this priority**: Traceable, safe media is the core promise of the product.

**Independent Test**: Upload a photo containing location metadata; confirm the displayed copy has none, a thumbnail exists, and the uploader is recorded. Upload the same file again and confirm it is rejected as a duplicate.

**Acceptance Scenarios**:

1. **Given** a verified, consenting guest, **When** they upload a valid photo, **Then** it appears in the gallery attributed to that guest.
2. **Given** a logged-in host of the event, **When** they upload a valid photo, **Then** it appears attributed to that host.
3. **Given** a photo with embedded location/camera metadata, **When** it is uploaded, **Then** the displayed and downloadable versions contain no such metadata.
4. **Given** a photo in a less-common image format, **When** uploaded, **Then** it is displayed in a widely-supported format and a thumbnail is available.
5. **Given** an identical file already in the event, **When** anyone uploads it, **Then** no second copy is created and the uploader is told it already exists.
6. **Given** two people uploading the exact same file at the same instant, **When** both complete, **Then** exactly one photo exists.
7. **Given** a file that claims to be an image but is not (or exceeds size limits), **When** uploaded, **Then** it is rejected and nothing is stored.
8. **Given** an unauthenticated visitor, or a host who does not own the event trying to upload as host, **When** they attempt to upload, **Then** the upload is refused.
9. **Given** a guest with no display name whose upload just succeeded, **When** the upload completes, **Then** they are offered an optional prompt to add a name; skipping it leaves the photo shown as anonymous and does not affect the upload.
10. **Given** a guest uploading their whole camera roll (dozens of photos) in one sitting, **When** they upload, **Then** every photo is accepted; ordinary bulk uploading is never treated as abuse.
11. **Given** a guest who has reached the upload limit for an event within the short window, **When** they try to upload more there, **Then** the attempt is refused with a clear message saying when they can continue, and the photos they already uploaded are unaffected.

---

### User Story 5 - Report a photo; it is hidden immediately (Priority: P1)

A verified guest reports a photo and picks a reason. The photo is hidden from everyone the moment the report is filed, before any host has looked at it.

**Why this priority**: Visibility is the harm; hiding first is the safe default.

**Independent Test**: Report a visible photo and confirm it disappears from the gallery for other viewers before any host action.

**Acceptance Scenarios**:

1. **Given** a verified guest viewing a photo, **When** they report it with a reason, **Then** the photo is hidden from all gallery views immediately.
2. **Given** an unverified visitor, **When** they try to report, **Then** they are asked to verify first.
3. **Given** a report reason of "harmful", **When** filed, **Then** both the host and the operator are alerted right away by email, even during the host's own event.
4. **Given** any other reason, **When** filed, **Then** the host is not interrupted and the report waits in their review queue.
5. **Given** a guest who already reported a photo, **When** they report it again, **Then** no duplicate report is created.
6. **Given** a guest who has reached the report limit for an event within the short window, **When** they try to file another report there, **Then** it is refused with a clear message, and their earlier reports and the photos they hid stay in force.
7. **Given** a guest who reached the limit in one event, **When** the window has passed, **Then** they can file reports there again; the limit in one event does not restrict them in a different event.

---

### User Story 6 - Host reviews reports; unreviewed reports fail safe (Priority: P2)

A host opens a dashboard listing reports for their events. For each, they decide to uphold (photo stays hidden or is removed) or dismiss (photo is restored). If a report is not reviewed within a set window, it resolves automatically with the photo kept hidden, and the host is notified. The owning host can also remove any photo in their event directly, without any guest report, and may mark it harmful.

**Why this priority**: Closes the loop on reports and guarantees the system never leaves harmful content exposed because a host was busy.

**Independent Test**: File a report, leave it unreviewed past the window, and confirm the photo remains hidden, the report shows as auto-resolved, and the host was notified. As the owning host, delete a photo nobody reported, then delete another and mark it harmful, and confirm the second leaves a surviving evidence record.

**Acceptance Scenarios**:

1. **Given** open reports, **When** the host opens the dashboard, **Then** they see each report with the photo, reason, and time.
2. **Given** an open report, **When** the host dismisses it, **Then** the photo is visible again and the report is closed.
3. **Given** an open report, **When** the host upholds it, **Then** the photo remains hidden and the report is closed.
4. **Given** a report unreviewed past the 72-hour review window, **When** the daily check runs, **Then** within 96 hours of being filed it auto-resolves with the photo kept hidden and the host is notified.
5. **Given** a host who does not own the event, **When** they try to view or act on its reports, **Then** access is refused.
6. **Given** the owning host viewing any photo in their event, **When** they delete it without any guest having reported it, **Then** it disappears from the gallery immediately.
7. **Given** the owning host deleting a photo, **When** they also mark it harmful, **Then** an evidence record is created exactly as for an upheld harmful report, with the host as both reporter and reviewer, the photo's uploader, and the file's content hash, and it survives after the photo is purged.
8. **Given** a photo with open guest reports, **When** the owning host deletes it, **Then** those reports are closed as upheld.
9. **Given** a host who does not own the event, **When** they try to delete a photo in it, **Then** access is refused.
10. **Given** the owning host deleting a photo without marking it harmful, **When** it is later purged, **Then** no evidence record remains for it.

---

### User Story 7 - Deletion, and evidence that survives it (Priority: P2)

A guest can delete their own uploaded photos, or separately delete their account identity. A host can delete an event or their entire account. Both host deletions are first reversible for a grace period, then permanently purged. Evidence of a genuinely harmful report (upheld, or auto-resolved without review) survives even after its photo and event are deleted.

**Why this priority**: Privacy control for users, balanced with the ability to act on genuine harm.

**Independent Test**: Uphold a harmful report, delete the event, wait past the grace period, and confirm the report, reporter, reviewer, uploader identity, and file content hash still exist while the photo and event are gone.

**Acceptance Scenarios**:

1. **Given** a guest's uploaded photos, **When** they delete one, **Then** it is removed from the gallery and their account stays intact.
2. **Given** a guest with uploads, **When** they delete their account identity, **Then** their identifier, verification, and login are removed, while their existing photos keep displaying exactly as before (under the name that was recorded, or as anonymous if none was given) with no "deleted" label. This is a separate action from deleting photos.
3. **Given** a host with an event, **When** they delete it, **Then** it disappears from view immediately and can be restored during the grace period.
4. **Given** a deleted event past its grace period, **When** the purge runs, **Then** its photos and data are permanently removed.
5. **Given** a host deleting their account, **When** confirmed, **Then** it follows the same delete-then-purge pattern for the account and all its events.
6. **Given** a harmful report that was upheld or auto-resolved, **When** its photo and event are purged, **Then** the report, the reporter, the reviewer, the photo's uploader, and the file's content hash remain.
7. **Given** a non-harmful report, **When** its event is purged, **Then** the report is removed along with it.
8. **Given** a guest who chooses to delete their account identity, **When** they start the action, **Then** they must first confirm a message stating that their existing photos will remain and can no longer be deleted by them afterward unless they remove them first; without that confirmation nothing is deleted.

---

### User Story 8 - Browse, download, and share the gallery (Priority: P1)

Anyone with an event link browses the event's visible photos in a gallery that shows how many photos there are, opens any photo in a full-size viewer that moves to the previous or next photo (buttons, arrow keys, and swipe on touch screens), downloads a photo through a short-lived link, and shares the event link. The host's QR code for the event lives on the host's own event view in their dashboard, not in the guest gallery.

**Why this priority**: These behaviors already exist in Phase 1. Replacing the PIN model must not lose them.

**Independent Test**: Open an event link with no sign-in, confirm the count matches the visible photos, open a photo, move through the photos by button and by swipe, download one, share the link, and confirm the host dashboard shows a QR code that opens the same gallery.

**Acceptance Scenarios**:

1. **Given** an event with visible photos, **When** anyone opens its link, **Then** the gallery shows the number of visible photos, which excludes hidden and deleted ones.
2. **Given** the gallery, **When** a viewer opens a photo, **Then** a full-size viewer opens with previous and next controls, and the first photo has no previous and the last has no next.
3. **Given** the viewer on a touch screen, **When** the viewer swipes left or right, **Then** it moves to the next or previous photo; keyboard arrow keys do the same on a computer.
4. **Given** the viewer, **When** they choose download, **Then** the photo is saved through a short-lived link (never a permanent public address) and the file contains no embedded location or device metadata.
5. **Given** a download link that has expired, **When** it is used, **Then** it no longer works and the viewer can request a fresh one.
6. **Given** a photo that has been hidden (for example by a report) or deleted, **When** anyone tries to open or download it, **Then** it is not available and it is not counted.
7. **Given** the gallery, **When** a viewer chooses share, **Then** the event link is offered through the device's share options where available, or copied to the clipboard otherwise, and anyone who opens it can view the gallery without signing in.
8. **Given** a logged-in host, **When** they open their event in the dashboard, **Then** a QR code for the event's current link is shown there; the guest gallery itself shows no QR code.
9. **Given** a closed event, **When** anyone opens it, **Then** browsing, the viewer, count, download, and share all still work.

---

### Edge Cases

- A guest's one-time code arrives late or is requested several times; only the most recent valid code works.
- A guest verifies from a second device; they are recognized as the same identity.
- A photo is reported while its uploader is deleting it.
- A host's account is deleted while reports on their events are still open.
- A guest deletes their account identity while their photos are under an open report.
- A duplicate file is uploaded to a different event (not treated as a duplicate; duplicates are per event).
- An upload is interrupted midway; no partial or orphaned photo appears in the gallery.
- A host is also a guest at someone else's event; the two identities stay separate.
- A host is offline for the whole review window; the auto-resolve still happens.
- A host closes an event while a guest is midway through an upload; the upload is refused cleanly and no partial photo appears.
- A photo in a closed event is reported; reporting, review, and deletion keep working on closed events.
- A host requests several password resets in a row; only the most recent link works.
- A password reset happens while the host has other devices logged in; those sessions end.
- One guest tries to hide many photos quickly; the report limit stops them, and earlier hidden photos stay hidden until reviewed.
- A guest who deleted their identity is the uploader on a harmful report; the evidence still names them by identity reference, though their email address is gone.
- A host never follows their confirmation link and never verifies; nothing is blocked, and the reminder stays.
- A host resets their password through the emailed link; that also proves they control the inbox, so the email counts as verified.
- A host requests many new confirmation links in a row; only the newest works and requests are limited.
- A guest hits the upload limit in one event; they can still upload in a different event and can still view, report, and delete.
- A person who is both a host and a guest (for example while testing) uploads to an event they own; they act as the host.
- The owning host deletes a photo while a guest is reporting it; the photo is removed and the report is closed as upheld, with no duplicate outcome.
- The owning host marks a photo they uploaded themselves as harmful; the evidence record names them as reporter, reviewer, and uploader.
- A download link is opened after it expires, or for a photo hidden since the gallery loaded; it fails cleanly and the viewer can retry.
- A viewer swipes past the last photo, or the photo they are viewing gets hidden while open; the viewer stays on a valid photo or closes.
- A guest confirms deleting their identity, then wants to delete a photo; they can't, and the host can still remove it.

## Requirements *(mandatory)*

### Functional Requirements

**Host accounts and events**

- **FR-001**: The system MUST let a visitor create a host account with an email and password and log in with them.
- **FR-002**: The system MUST enforce a minimum password strength and reject weak passwords.
- **FR-003**: The system MUST let a host create and manage multiple events under one account.
- **FR-004**: The system MUST show and permit access to only the events owned by the logged-in host.
- **FR-005**: Login failures MUST NOT reveal whether an email is registered.
- **FR-036**: A host MUST be able to close an event they own. While an event is closed, the system MUST refuse new uploads from everyone, including uploads started before the close, and MUST keep its visible photos viewable to anyone with the link. Reporting, review, and deletion MUST continue to work on a closed event. The host MUST be able to reopen it.
- **FR-038**: A host MUST be able to reset a forgotten password through a link sent to their account email. The link MUST be single-use and expire after a short period; requesting a reset MUST NOT reveal whether an email has an account; the number of reset requests MUST be limited; completing a reset MUST apply the password strength rules and end all of that account's existing login sessions.
- **FR-040**: After signup, the system MUST send the host a confirmation link by email; following it MUST mark the host's email as verified. The link MUST be single-use and expire after a short period, a host MUST be able to request a new one, and the number of new-link requests MUST be limited. Verification MUST NOT gate account creation, event creation, or any other action. Rationale: this closes a traceability gap for host-specific alerts (knowing that alerts reach a real inbox the host controls), but it is not the only safety mechanism, because harmful-report alerts also go to the operator regardless of a host's email status.
- **FR-041**: While a host's email is unverified, the host's dashboard MUST show a persistent reminder with a way to request a new confirmation link; the reminder MUST disappear once the email is verified.

**Guest identity**

- **FR-006**: The system MUST let anyone with an event link view its visible photos without verifying.
- **FR-007**: The system MUST require a guest to verify their identifier with a one-time code, sent through the configured channel (currently email), before they can upload or report.
- **FR-008**: One-time codes MUST expire after a short period, work only once, and be limited in how many can be requested and attempted per identifier. A guest MUST be able to ask for a code to be sent again while their previous code is still valid and unused, and such a resend MUST NOT count against the per-identifier limit on new codes as harshly as a new request does (it is bounded separately and more generously), so that someone else cannot easily exhaust a real guest's limit to keep them from verifying.
- **FR-009**: A guest's verified identifier MUST establish one guest identity that persists across all events, with no re-verification for a second event.
- **FR-010**: A verified identifier MUST map to exactly one guest identity.
- **FR-051**: Guest verification MUST be provider-based and channel-agnostic: the channel (currently email) and the kind of identifier MUST be configurable, and the rest of the system (sessions, consent, media, reports, evidence) MUST refer to a guest only by their guest identity, never by the identifier. Switching to another channel, such as phone text messages, MUST require only adding one provider and changing configuration.
- **FR-052**: The system MUST cap the total number of verification emails it sends per day across all guests. The cap MUST be generous and sized to the peak of a real event, meaning a single reception's worth of guests verifying within a short window, and MUST NOT include a tight short-window system-wide limit. The safety alerts and notices sent to hosts and the operator (harmful-report alerts and auto-hold notices) MUST be exempt from the cap. A guest who hits the daily cap MUST be told to try again later.
- **FR-039**: After a guest's upload succeeds, the system MUST offer them an optional prompt to add a display name. The name MUST NOT be required to verify or to upload, the prompt MUST be skippable, and photos MUST show the name when one exists and appear as anonymous otherwise.

**Gallery and sharing**

- **FR-043**: The gallery MUST let a viewer open any visible photo in a full-size viewer with previous and next navigation by controls, keyboard arrows, and touch swipe, moving only among currently visible photos.
- **FR-044**: The gallery MUST let a viewer download any visible photo through a short-lived signed link, never a permanent public address. Hidden or deleted photos MUST NOT be downloadable, and the downloaded file MUST contain no embedded metadata (FR-017). Downloads MUST keep working on a closed event.
- **FR-045**: The gallery MUST show the count of currently visible photos, excluding hidden and deleted ones.
- **FR-046**: The gallery MUST offer a share action for the event link, using the device's share options where available and copying the link otherwise.
- **FR-047**: The host's QR code for an event MUST be shown on the host's own event view in their dashboard and MUST encode the event's current link; the guest gallery MUST NOT show a QR code.

**Consent**

- **FR-011**: Before a guest's first upload in an event, the system MUST show a disclosure specific to that event's audience and record the guest's agreement for that event.
- **FR-012**: Consent MUST be tracked per guest per event and MUST NOT carry over to other events.

**Upload and media integrity**

- **FR-013**: A host (owner of the event) or a verified, consenting guest MUST be able to upload photos to an event.
- **FR-014**: Every uploaded photo MUST have exactly one uploader, which is either a host or a guest, never neither and never both.
- **FR-015**: The system MUST verify each upload on the server, independent of anything the client claims, including actual file type and size limits.
- **FR-016**: The system MUST detect exact-duplicate files within an event and MUST NOT create a second photo for one, including when identical files are uploaded simultaneously.
- **FR-017**: The system MUST strip embedded metadata from uploaded photos before they are shown or downloaded.
- **FR-018**: The system MUST convert photos to a widely-supported display format and generate a thumbnail for each.
- **FR-019**: A failed or interrupted upload MUST NOT leave a visible partial photo.
- **FR-042**: The system MUST limit how many uploads a single guest can perform within one event in a short period, to prevent storage and cost abuse. This limit MUST be deliberately more generous than the report limit (FR-037): a guest uploading dozens of photos at once, such as their full camera roll at the end of an event, is normal and MUST NOT be blocked. A guest who reaches the limit MUST be told clearly when they can continue, and photos already uploaded MUST be unaffected. The exact number and window are set at planning time.

**Reporting and moderation**

- **FR-020**: A verified guest MUST be able to report a photo by choosing a reason from a fixed list that includes "harmful".
- **FR-021**: Filing a report MUST hide the photo from all gallery views immediately, before any review.
- **FR-022**: A guest MUST NOT be able to file more than one open report on the same photo.
- **FR-037**: The system MUST limit how many reports a single guest can file within one event in a short period, so one guest cannot mass-hide an event's content. Reports already filed MUST stay in force when the limit is reached, and the guest MUST be told clearly why a further report was refused. The exact number and window are set at planning time.
- **FR-023**: A "harmful" report MUST immediately alert both the host and the operator by email; all other reports MUST queue silently for later review.
- **FR-024**: The system MUST give each host a dashboard of reports on their events with the ability to uphold or dismiss each.
- **FR-025**: Dismissing a report MUST restore the photo; upholding MUST keep it hidden.
- **FR-026**: Every report left unreviewed past a fixed 72-hour review window, whatever its reason, MUST auto-resolve within 96 hours of being filed (the automatic check runs once a day) with the photo kept hidden, and the host MUST be notified by email.
- **FR-027**: Hosts MUST be able to act only on reports for events they own.

**Deletion**

- **FR-028**: A guest MUST be able to delete their own uploaded photos without deleting their account identity.
- **FR-029**: A guest MUST be able to delete their account identity as a separate action from deleting photos.
- **FR-030**: A host MUST be able to delete an event or their whole account; each MUST be hidden immediately, recoverable during a grace period, and permanently purged afterward.
- **FR-031**: Evidence of a harmful report, meaning one that was upheld, auto-resolved without review, or created when the owning host removed a photo and marked it harmful, MUST survive the deletion and purge of its photo and event. That evidence MUST include the report itself (reason, outcome, and times), the reporter, the reviewer, the identity of the photo's uploader (host or guest), and the content hash of the uploaded file.
- **FR-032**: Non-harmful reports MUST be removed with their event when it is purged.
- **FR-048**: The owning host of an event MUST be able to delete any photo in that event directly, without a guest report, including in a closed event. Any open reports on that photo MUST be closed as upheld. A host who does not own the event MUST NOT be able to do this.
- **FR-049**: When the owning host deletes a photo directly, they MAY mark it harmful. If they do, the system MUST create the same evidence record as an upheld guest report would, with the host as both reporter and reviewer, plus the photo's uploader and content hash, so traceability holds even when no guest filed a report. A deletion not marked harmful MUST leave no evidence record.
- **FR-050**: Before a guest's account identity is deleted, the system MUST show a confirmation stating that their existing photos will remain and can no longer be deleted by them afterward unless they remove them first, and MUST NOT delete anything until the guest explicitly confirms.

**Privacy and security**

- **FR-033**: The system MUST validate all user-supplied input on the server.
- **FR-034**: The system MUST NOT record guests' identifiers, one-time codes, or session credentials in any logs.
- **FR-035**: Sessions MUST be revocable and MUST end on logout.

### Key Entities

- **Host**: A person with an email-and-password account who owns events and can reset a forgotten password through that email. Their email is either verified or not; being unverified restricts nothing.
- **Event**: A gathering owned by one host, with its own audience, photos, and reports. It is either open or closed; a closed event accepts no new uploads.
- **Guest**: A person with a verified-identifier identity (currently an email address) that works across all events, and an optional display name shown with their photos.
- **Consent**: A guest's recorded agreement to one event's audience disclosure.
- **Photo**: A processed image in one event, attributed to exactly one uploader (a host or a guest), with a thumbnail and visibility state.
- **Report**: A guest's flag on a photo with a reason, a status (open, upheld, dismissed, auto-resolved), and a harmful/non-harmful classification.
- **Harm Evidence**: The preserved record of a harmful report (upheld, auto-resolved, or a host's harmful-marked removal, where the host is both reporter and reviewer), kept after the photo and event are gone: the report (reason, outcome, times), the reporter, the reviewer, the photo's uploader, and the content hash of the uploaded file.
- **Session**: A revocable proof of login for a host or guest.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A host can sign up, create at least two events, and see only their own events; a second host never sees them.
- **SC-002**: A guest verifies their identifier once and is recognized at a second, different event with zero additional verification steps.
- **SC-003**: A first-time guest can verify and upload their first photo in under 2 minutes.
- **SC-004**: Two guests uploading the exact same file, including at the same instant, always result in exactly one photo.
- **SC-005**: 100% of displayed and downloadable photos contain no embedded location or device metadata.
- **SC-006**: 100% of photos have exactly one recorded uploader, either host or guest.
- **SC-007**: A reported photo is hidden from all viewers within 2 seconds of the report, before any host action.
- **SC-008**: 100% of reports left unreviewed for the full 72-hour review window end auto-resolved within 96 hours of being filed, with the photo hidden throughout and the host notified.
- **SC-009**: A "harmful" report reaches both the host and the operator within 1 minute; other reports interrupt no one.
- **SC-010**: After an event is deleted and purged, the harm evidence for its harmful reports (report, reporter, reviewer, uploader identity, and content hash) is still retrievable, while all its photos are gone.
- **SC-011**: Guests can view any event's gallery with no sign-in step.
- **SC-012**: However fast a single guest acts, they can never hide more photos in one event than the report limit allows within its window.
- **SC-013**: A host who forgot their password can regain access from their account email in under 5 minutes, and the old password stops working once reset.
- **SC-014**: 100% of upload attempts to a closed event are refused with nothing stored, while 100% of its visible photos stay viewable.
- **SC-015**: An unverified host can complete every host action (0 actions blocked), sees the reminder on every dashboard visit until verified, and never sees it after verifying.
- **SC-016**: A guest can upload at least a full camera roll's worth of photos in one sitting in one event without being blocked, while a single guest still cannot exceed the upload limit within its window.
- **SC-017**: 100% of photo downloads use links that stop working within 5 minutes, and no photo is reachable through a permanent public address.
- **SC-018**: The photo count shown in the gallery equals the number of visible photos at the moment it loads.
- **SC-019**: A photo the owning host deletes and marks harmful leaves the same surviving evidence (reporter, reviewer, uploader, content hash) as an upheld guest report, even though no guest reported it.
- **SC-020**: 100% of guest identity deletions are preceded by the confirmation message, and cancelling it deletes nothing.
- **SC-021**: A single large event's guests (a reception's worth, for example 300) can all verify within one hour without any of them being refused by a system-wide limit; no day sends more verification emails than the daily cap; and while the cap is reached, 100% of harmful-report alerts and auto-hold notices are still delivered.

## Assumptions

- Hosts and guests are separate identity types; the same person acting as both uses two separate identities.
- The review window for unreviewed reports is 72 hours. It applies to every unreviewed report, whatever its reason. The host is notified by email when reports auto-resolve. Because the automatic check runs once a day, a report actually resolves between 72 and 96 hours after it was filed; the photo is hidden the whole time.
- The gallery features that existed in Phase 1 (full-size viewer with previous/next and swipe, per-photo download, photo count, share) are kept and rebuilt on the new model. The download link lasts the same 5 minutes as viewing links, anyone who can view a photo can download it, and sharing uses the device's share options where available and otherwise copies the link.
- The host's QR code lives on the host's own event view in the dashboard, next to the event's link, and encodes the event's current link. The guest gallery shows a share action but no QR.
- When the owning host removes a photo directly, no email alert goes to the operator, since the host is the one acting. Open guest reports on that photo close as upheld. A removal that is not marked harmful is an ordinary deletion and keeps no evidence.
- Guest identity deletion requires an explicit confirmation (FR-050). Photos are not removed by it, so a guest who wants them gone must delete them first.
- A "harmful" report emails both the host and the operator of the service immediately. The operator is the person running Memento, not an event host.
- Photo links given to viewers stop working within 5 minutes, so a photo hidden after a report can remain reachable through an already-open page for up to 5 minutes at most.
- Closing an event is reversible: the host can reopen it. Closing only stops new uploads; it does not delete or hide anything.
- The report limit is per guest, per event, over a short rolling window. It does not apply to hosts, who moderate through the review dashboard.
- The soft-delete grace period before permanent purge is 30 days for events and host accounts.
- "Harmful" is one option in a fixed reason list: self-removal request, inappropriate, harmful, other. Only harmful reports interrupt the host in real time and only harmful reports (upheld or auto-resolved) keep their evidence record after deletion; every other report is removed with its event.
- Duplicate detection applies within a single event, not across events.
- When a guest deletes their account identity, only their own identifying data (their identifier) is removed. Their existing photos continue displaying exactly as before, under whatever name was recorded, or as anonymous if none was given, with no "deleted guest" label, unless they delete the photos separately.
- A guest's display name is optional and never asked for at verification. It is collected by an optional prompt shown after the guest's upload succeeds (FR-039); a guest who skips it stays anonymous. A name already recorded is kept when the guest deletes their identity.
- Evidence and uploader records refer to people by their account identity, not by personal details. Deleting an account removes details such as an email address, but not the identity reference that evidence points to.
- Only still photos are supported in this feature; video is deferred.
- Guests verify by entering a one-time code sent to their email address, through the same email service used for other notifications. Verification goes through a channel-agnostic provider, so a later switch to another channel, such as phone text messages, needs one new provider and a configuration change and nothing else: the rest of the system refers to a guest only by their guest identity, never by the address. Hosts receive notifications at their account email.
- Email verification proves control of an inbox, not that the guest is one particular real person, and one person can hold several inboxes. Per-guest limits (reports, uploads) therefore bind to an identity, not a human. This is an accepted consequence of choosing email as the channel.
- How guests who verified by email are treated once a phone channel exists, whether they are ever required to additionally verify a phone or both stay valid indefinitely, is intentionally not decided yet.
- No phone number is collected from guests for now. A phone number will be considered only once an SMS channel is actually chosen, as a separate change.
- Verification codes are single-use, expire after a short time, and are limited per address and by a generous daily system-wide cap sized to a real event's peak. A guest whose code has not arrived can ask for it to be sent again while the previous code is still valid and unused; that does not use up their limit on new codes, so someone else cannot easily exhaust a real guest's limit. Fully stopping a determined attacker from delaying a victim would need per-source limits, which are not built.
- Emails (guest verification codes, signup confirmation, password reset, harmful-report alerts, auto-hold notices) are sent after the response is returned, so a slow or failing mail service never delays or undoes hiding a reported photo. Unsent alerts and notices are retried by the next daily check, and the operator is emailed if the daily check itself fails.
- Signup tells a visitor when an email is already registered. This is an accepted usability tradeoff; login and password reset never reveal whether an email has an account.
- Host password reset is a real requirement of this feature (FR-038). Host email verification (FR-040, FR-041) is non-blocking by design: an unverified host is fully functional, and alerts and reset links are still sent to the address on file.
- Because harmful-report alerts always go to the operator as well as the host, an unverified or mistyped host email never leaves a harmful report unseen; verification improves traceability of host-specific alerts and reset delivery rather than being the safety net.
- The upload limit is per guest, per event, over a short rolling window, and counts upload attempts, including failed ones. It does not apply to hosts uploading to their own events. Its number is set well above normal bulk uploading (see FR-042).
- Pricing, automated inappropriate-content detection, co-hosts, accessibility beyond age and tech-comfort, and video upload are deferred, not decided against.
- Phase 1's PIN and anonymous-guest model is fully replaced by this feature, per the project constitution (v2.0.0 onward).
