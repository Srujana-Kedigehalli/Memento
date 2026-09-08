# API Contracts: Phase 1 - Single-User End-to-End Flow

All endpoints are Next.js API routes (or equivalent Server Actions) under `app/api/`. All
request/response bodies are JSON unless noted. No endpoint accepts raw photo bytes.

## POST /api/events

Create the event (host action).

**Request body**:
```json
{ "name": "string", "eventDate": "YYYY-MM-DD", "pin": "string" }
```

**Response 201**:
```json
{ "eventId": "uuid", "uploadUrl": "https://.../e/{eventId}/upload", "galleryUrl": "https://.../e/{eventId}/gallery" }
```
(host session cookie set on success, scoped to `eventId` — same cookie `verify-pin` sets, since
the host has just proven the PIN by choosing it)

**Errors**: `400` if `name`/`eventDate`/`pin` missing or invalid.

---

## POST /api/events/{eventId}/verify-pin

Check a host-supplied PIN for an existing event; sets a session cookie on success.

**Request body**:
```json
{ "pin": "string" }
```

**Response 200**: `{ "ok": true }` (cookie set)
**Response 401**: `{ "ok": false }` if PIN does not match.

---

## GET /api/events/{eventId}/qr

Return a QR code encoding the event's gallery URL (guests land on the shared gallery, which
includes the upload action — not a separate upload-only page). Host-only action (FR-002):
requires a valid host session cookie for `eventId` (set by `POST /api/events` or `POST
/api/events/{eventId}/verify-pin`).

**Response 200**: `{ "dataUrl": "data:image/png;base64,..." }` (or serves image bytes directly,
implementation choice)

**Errors**: `401` `{ "ok": false }` if the session cookie is missing/invalid (same error shape as
`verify-pin`); `404` if event does not exist.

---

## POST /api/events/{eventId}/upload-url

Issue a presigned Supabase Storage upload URL for one photo. Called once per photo the guest
selects, before the browser uploads that file directly to Storage.

**Request body**:
```json
{ "fileName": "string", "contentType": "image/jpeg" }
```

**Response 200**:
```json
{ "signedUrl": "https://.../storage/v1/...", "storagePath": "events/{eventId}/{generatedName}" }
```

**Errors**: `400` if `contentType` is not an accepted image type; `404` if event does not
exist.

**Notes**: This is the only endpoint involved in "sending" a photo from the guest's
perspective; the actual bytes go from the browser directly to `signedUrl`, never through this
API route.

---

## POST /api/events/{eventId}/photos

Record a photo row **after** the browser's direct Storage upload (to `signedUrl` from the
previous call) has succeeded.

**Request body**:
```json
{ "storagePath": "string" }
```

**Response 201**:
```json
{ "photoId": "uuid", "uploadedAt": "ISO-8601 timestamp" }
```

**Errors**: `400` if `storagePath` missing; `404` if event does not exist.

---

## GET /api/events/{eventId}/photos

List all photos for the event (used by the gallery page), most recent first.

**Response 200**:
```json
{
  "count": 3,
  "photos": [
    { "photoId": "uuid", "url": "https://.../storage/.../photo.jpg", "uploadedAt": "ISO-8601 timestamp" }
  ]
}
```

**Errors**: `404` if event does not exist (guest sees a "not found" state per spec edge case).

---

## Client-Side Features (No New Endpoints)

### Share Button (FR-013)

The host event page includes a "Share" button that shares the `galleryUrl` returned from
`POST /api/events`. Implementation uses `navigator.share()` (Web Share API) when available
(supported on most mobile browsers); on unsupported browsers (desktop Chrome, older browsers),
the button triggers a fallback "copy link" action via the Clipboard API. No API endpoint
needed — uses `galleryUrl` returned by event creation.

**Share data sent**:
```json
{ "title": "Memento Album", "text": "Join my event", "url": "https://.../e/{eventId}/gallery" }
```

### Photo Downloads (FR-014)

Each photo in the gallery is displayed with a download option (e.g., download button or
right-click). The download link is a simple `<a href={url} download>` HTML element, where
`url` is the public Storage URL already provided by `GET /api/events/{eventId}/photos`. No
new API endpoint needed — direct download via public Storage URL (bucket is configured as
public-read, so no signed URL or auth required).

### Lightbox & Carousel (FR-015)

Clicking a photo thumbnail in the gallery opens a full-screen lightbox modal (using shadcn/ui
Dialog component). The lightbox displays the same photo URL and allows navigation to the
previous/next photo in the gallery via arrow keys (desktop) or swipe gestures (mobile)
without reloading the page. This is a client-side feature with no API involvement — it
rearranges and displays the photos already fetched by the gallery page via
`GET /api/events/{eventId}/photos`.
