create extension if not exists pgcrypto;

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  event_date date not null,
  pin        text not null,
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);

create index if not exists photos_event_id_idx on photos(event_id);
