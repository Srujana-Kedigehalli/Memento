# Data Model: Phase 1 - Single-User End-to-End Flow

## Entities

### Event

Represents the single wedding event (Constitution Principle I: one event for the app's
lifetime; schema does not hard-limit rows, but Phase 1 product flow only creates/uses one).

| Field       | Type                        | Notes                                              |
|-------------|-----------------------------|-----------------------------------------------------|
| `id`        | `uuid` (PK, default `gen_random_uuid()`) | Used to build upload/gallery URLs           |
| `name`      | `text`, not null             | Event name, e.g., "Alex & Sam's Wedding"           |
| `event_date`| `date`, not null             | Date of the event                                  |
| `pin`       | `text`, not null              | Host PIN; stored hashed (see Research §4)          |
| `created_at`| `timestamptz`, not null, default `now()` | Creation timestamp                     |

**Validation rules**:
- `name` must be non-empty.
- `event_date` must be a valid date (no future/past restriction required by spec).
- `pin` must be non-empty; format left to implementation (e.g., 4–6 digits) since spec does
  not constrain it — reasonable default, not a blocking clarification.

**Relationships**: One `Event` has many `Photo` rows.

### Photo

Represents a single uploaded image, associated with exactly one event (spec Key Entities).

| Field         | Type                        | Notes                                             |
|---------------|-----------------------------|----------------------------------------------------|
| `id`          | `uuid` (PK, default `gen_random_uuid()`) | Unique photo identifier               |
| `event_id`    | `uuid`, not null, FK → `events(id)` | Association to its event               |
| `storage_path`| `text`, not null              | Path/key within the Supabase Storage bucket        |
| `file_hash`   | `text`, nullable              | SHA-256 hash of the file bytes (hex-encoded); used for exact-duplicate detection. Computed client-side (Web Crypto API) before upload. |
| `uploaded_at` | `timestamptz`, not null, default `now()` | Used for gallery ordering (most recent first) |

**Validation rules**:
- `event_id` must reference an existing event (FK constraint).
- `storage_path` must be non-empty and must correspond to a file that was actually written to
  Storage (recorded only after the browser's direct upload succeeds — see contracts).
- `file_hash` (when present) must be unique within the event: no two photos in the same event
  can have the same hash (unique constraint on `(event_id, file_hash)`). This prevents exact
  byte-identical duplicates from being uploaded twice to the same event.

**Relationships**: Many `Photo` rows belong to one `Event` (`ON DELETE CASCADE` recommended so
orphaned photo rows can't outlive their event, though event deletion is out of scope for this
phase's UI).

**State/lifecycle**: A `Photo` row is only created *after* the browser confirms the direct
Storage upload succeeded (client calls the "record photo" endpoint post-upload). There is no
"pending"/"failed" state persisted — failed uploads simply never produce a row, satisfying the
edge case "an interrupted upload should not show a partially-uploaded photo in the gallery."

**Duplicate Detection**: Before requesting a presigned upload URL, the client computes the file's
SHA-256 hash using the Web Crypto API. This hash is sent with the upload-url request. The server
checks if a photo with that hash already exists for the event; if so, it returns the existing
photo's info instead of issuing a new URL, and the guest is informed the photo is already in the
gallery. This eliminates wasted storage and bandwidth for exact duplicates.

## Migration Sketch

### `db/migrations/001_init.sql` — Initial schema

```sql
create extension if not exists pgcrypto;

create table events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  event_date date not null,
  pin        text not null,
  created_at timestamptz not null default now()
);

create table photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);

create index photos_event_id_idx on photos(event_id);
```

### `db/migrations/002_add_duplicate_detection.sql` — Add file hash for duplicate detection

```sql
alter table photos add column file_hash text;

alter table photos
  add constraint photos_event_id_file_hash_unique unique (event_id, file_hash) deferrable initially deferred;

create index photos_file_hash_idx on photos(file_hash);
```

**Note on migrations**: Phase 1 deploys both migrations together (001 for the initial schema,
002 for duplicate detection). They are sequenced to avoid altering a table immediately after
creation (cleaner deployment and rollback semantics).

**Note on additional tables**: No other tables appear necessary for this phase's scope
(single event, no accounts, no moderation, no tagging/face-matching per spec's explicit
out-of-scope list). If a later phase needs multiple events or guest identity, that will
require a schema amendment at that time, not now (Constitution Principle II).