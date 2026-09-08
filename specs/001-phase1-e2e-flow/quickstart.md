# Quickstart: Validate Phase 1 End-to-End Flow

This validates the full loop described in [spec.md](./spec.md) on a real deployed URL from a
real phone, per FR-011 and SC-004. See [data-model.md](./data-model.md) for schema and
[contracts/api.md](./contracts/api.md) for endpoint details.

## Prerequisites

- App deployed to Vercel and connected to the `main` branch (per constitution).
- Environment variables set in Vercel (not committed to the repo):
  - Supabase Postgres connection string (for `pg`)
  - Supabase project URL + service role (or equivalent) key for Storage signed URLs
- A Supabase Storage bucket created for event photos, with Data API disabled per constitution.
- Database migration applied (`db/migrations/001_init.sql`) against the Supabase Postgres
  instance.
- A phone with a camera app capable of scanning QR codes, and at least one photo already on
  the device (or the ability to take one).

## Steps

1. **Create the event (host)**
   - On a computer or phone, open the deployed app's home page.
   - Enter an event name, date, and a PIN.
   - Submit and confirm a QR code is displayed along with the event's upload link.
   - *Expected*: QR code renders within a couple of seconds (SC-001: under 2 minutes total).

2. **Scan the QR code (guest)**
   - Using a real phone's camera app, scan the displayed QR code.
   - Confirm it opens the event's shared gallery page directly in the phone's browser (not a
     separate upload-only page), with no login/account prompt, and an "Upload memories" action
     visible.

3. **Upload one or more photos (guest)**
   - On the gallery page, open the "Upload memories" action and choose one photo from the
     phone's existing photo library (confirm the picker offers the library, not only the
     camera).
   - Submit the upload and confirm a success indication, and that the photo appears in the
     gallery without leaving the page.
   - Repeat choosing multiple photos in one session and confirm all are accepted.
   - Attempt to select a non-image file (if easily testable) and confirm it is rejected with a
     clear message.

4. **View the gallery**
   - Navigate to the event's gallery page (link shown alongside the QR code, or via
     `/e/{eventId}/gallery`).
   - Confirm every uploaded photo appears and the displayed count matches the number of photos
     uploaded.
   - Upload one more photo, return to the gallery, manually refresh, and confirm the new photo
     and updated count appear (FR-010).

5. **Confirm real-device, real-URL operation**
   - Confirm every step above was performed against the live Vercel URL (not `localhost`) and
     from a real phone (not a desktop browser device emulator), satisfying FR-011 and SC-004.

## Expected Outcome

All steps complete without developer intervention, matching spec Success Criteria SC-001
through SC-004. Any failure (e.g., PIN check fails unexpectedly, upload silently drops a
photo, gallery count mismatches actual photos) indicates a defect to fix before this phase is
considered done.
