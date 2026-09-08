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
| `uploaded_at` | `timestamptz`, not null, default `now()` | Used for gallery ordering (most recent first) |

**Validation rules**:
- `event_id` must reference an existing event (FK constraint).
- `storage_path` must be non-empty and must correspond to a file that was actually written to
  Storage (recorded only after the browser's direct upload succeeds — see contracts).

**Relationships**: Many `Photo` rows belong to one `Event` (`ON DELETE CASCADE` recommended so
orphaned photo rows can't outlive their event, though event deletion is out of scope for this
phase's UI).

**State/lifecycle**: A `Photo` row is only created *after* the browser confirms the direct
Storage upload succeeded (client calls the "record photo" endpoint post-upload). There is no
"pending"/"failed" state persisted — failed uploads simply never produce a row, satisfying the
edge case "an interrupted upload should not show a partially-uploaded photo in the gallery."

## Migration Sketch (`db/migrations/001_init.sql`)

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

**Note on additional tables**: No other tables appear necessary for this phase's scope
(single event, no accounts, no moderation, no tagging/face-matching per spec's explicit
out-of-scope list). If a later phase needs multiple events or guest identity, that will
require a schema amendment at that time, not now (Constitution Principle II).
