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

Return a QR code encoding the event's upload URL. Host-only action (FR-002): requires a valid
host session cookie for `eventId` (set by `POST /api/events` or `POST
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
