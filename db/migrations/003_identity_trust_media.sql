-- Migration 003: identity, trust, and media handling (spec 002-identity-trust-media).
--
-- DESTRUCTIVE: Phase 1 data (events, photos) is disposable test data, so this migration TRUNCATES
-- both tables first. Run it only against a database where that is acceptable. It does not touch the
-- Phase 1 files already in the Storage bucket under events/ — delete those by hand.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- Phase 1 teardown
-- ---------------------------------------------------------------------------------------------
truncate table photos, events cascade;
drop table if exists photos;
alter table events drop column if exists pin;

-- ---------------------------------------------------------------------------------------------
-- Hosts (email + password) and their sessions and one-time tokens
-- ---------------------------------------------------------------------------------------------
create table hosts (
  id                 uuid primary key default gen_random_uuid(),
  -- normalized to lowercase by the app; null after the account is tombstoned
  email              text,
  -- null = unverified. Never gates any action; it only drives the dashboard reminder.
  email_verified_at  timestamptz,
  -- bcrypt hash; null after the account is tombstoned
  password_hash      text,
  failed_login_count integer not null default 0,
  locked_until       timestamptz,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  purge_after        timestamptz
);
create unique index hosts_email_key on hosts (email);

create table host_sessions (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references hosts(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index host_sessions_host_id_idx on host_sessions (host_id);

create table password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references hosts(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index password_reset_tokens_host_idx on password_reset_tokens (host_id, created_at);

create table email_verification_tokens (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references hosts(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index email_verification_tokens_host_idx on email_verification_tokens (host_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------------------------
-- events was emptied above, so NOT NULL columns can be added without a default.
alter table events add column access_token text not null;
alter table events add column closed_at    timestamptz;
alter table events add column deleted_at   timestamptz;
alter table events add column purge_after  timestamptz;
create unique index events_access_token_key on events (access_token);

-- Plain join table: one 'owner' row per event today, ready for co-hosts later.
-- event_id CASCADES on purpose: nothing should block deleting an event because of this table.
-- Contrast media.event_id below, which deliberately does NOT cascade.
create table event_hosts (
  event_id uuid not null references events(id) on delete cascade,
  host_id  uuid not null references hosts(id),
  role     text not null default 'owner' check (role in ('owner')),
  primary key (event_id, host_id)
);
create index event_hosts_host_idx on event_hosts (host_id);
comment on table event_hosts is
  'Plain join table. event_id cascades on delete on purpose (it must never block deleting an event). '
  'Do NOT copy this cascade onto media: see the comment on media.event_id.';

-- ---------------------------------------------------------------------------------------------
-- Guests: generic verified identity. A guest is keyed by (identifier, channel); everything else in
-- the system (sessions, consent, media, reports, evidence) refers to a guest by id only.
-- ---------------------------------------------------------------------------------------------
create table guests (
  id          uuid primary key default gen_random_uuid(),
  -- the verified address on the guest's channel, normalized by the verification provider
  identifier  text,
  -- 'email' today, 'phone' anticipated; no CHECK on the values so a new channel needs no migration
  channel     text,
  verified_at timestamptz,
  name        text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint guests_identifier_channel_key unique (identifier, channel),
  constraint guests_identity_all_or_none check (
    (identifier is null and channel is null and verified_at is null)
    or (identifier is not null and channel is not null and verified_at is not null)
  )
);
comment on column guests.identifier is
  'Verified address on the guest''s channel. Read only by the verification module and the identity-deletion route. Cleared (with channel and verified_at) when the identity is deleted.';

create table guest_sessions (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid not null references guests(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index guest_sessions_guest_id_idx on guest_sessions (guest_id);

create table event_guests (
  event_id        uuid not null references events(id) on delete cascade,
  guest_id        uuid not null references guests(id),
  consented_at    timestamptz not null default now(),
  consent_version integer not null,
  primary key (event_id, guest_id)
);

-- Verification codes. Rows are also the rolling-window counters for the throttles, so housekeeping
-- keeps them for at least 25 hours regardless of expired/used status.
create table otp_codes (
  id            uuid primary key default gen_random_uuid(),
  identifier    text not null,
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempt_count integer not null default 0,
  created_at    timestamptz not null default now(),
  used_at       timestamptz,
  is_resend     boolean not null default false
);
create index otp_codes_identifier_created_idx on otp_codes (identifier, created_at);
create index otp_codes_created_idx on otp_codes (created_at);

-- ---------------------------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------------------------
create table media (
  id             uuid primary key default gen_random_uuid(),
  -- DELIBERATELY NO "on delete cascade" (unlike event_hosts.event_id). The purge sequence (detach
  -- harmful evidence, delete media explicitly, then delete the event) must stay in the application's
  -- control, so the database never silently cascades media away before evidence is detached.
  -- DO NOT ADD A CASCADE TO MEDIA.
  event_id       uuid not null references events(id),
  guest_id       uuid references guests(id),
  host_id        uuid references hosts(id),
  content_hash   text not null,
  storage_path   text not null,
  thumbnail_path text not null,
  mime_type      text not null,
  byte_size      bigint not null,
  width          integer,
  height         integer,
  visibility     text not null default 'visible' check (visibility in ('visible', 'hidden')),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  purge_after    timestamptz,
  constraint media_exactly_one_uploader check (num_nonnulls(guest_id, host_id) = 1)
);
comment on column media.event_id is
  'DELIBERATELY NO ON DELETE CASCADE. Purge detaches harmful-report evidence first, deletes media '
  'explicitly, then deletes the event. Do NOT "fix" this to match event_hosts.';
create unique index media_event_content_hash_key on media (event_id, content_hash) where deleted_at is null;
create index media_event_created_idx on media (event_id, created_at);

create table upload_intents (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  guest_id      uuid references guests(id),
  host_id       uuid references hosts(id),
  temp_path     text not null,
  declared_mime text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  finalized_at  timestamptz,
  constraint upload_intents_exactly_one_uploader check (num_nonnulls(guest_id, host_id) = 1)
);
create index upload_intents_guest_event_created_idx on upload_intents (guest_id, event_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- Reports (and harmful-report evidence). People references are plain foreign keys (RESTRICT):
-- a guest or host referenced by evidence is tombstoned, never hard-deleted. media_id and event_id
-- are SET NULL so harmful evidence can be detached rather than cascade-deleted.
-- ---------------------------------------------------------------------------------------------
create table reports (
  id                    uuid primary key default gen_random_uuid(),
  media_id              uuid references media(id) on delete set null,
  event_id              uuid references events(id) on delete set null,
  reporter_guest_id     uuid references guests(id) on delete restrict,
  reporter_host_id      uuid references hosts(id) on delete restrict,
  reason                text not null,
  note                  text,
  status                text not null default 'open',
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  reviewed_by           uuid references hosts(id) on delete restrict,
  uploader_guest_id     uuid references guests(id) on delete restrict,
  uploader_host_id      uuid references hosts(id) on delete restrict,
  content_hash          text not null,
  alerted_at            timestamptz,
  auto_hold_notified_at timestamptz,
  constraint reports_reason_check check (reason in ('self_removal', 'inappropriate', 'harmful', 'other')),
  constraint reports_status_check check (status in ('open', 'upheld', 'dismissed', 'auto_held')),
  constraint reports_exactly_one_reporter check (num_nonnulls(reporter_guest_id, reporter_host_id) = 1),
  constraint reports_exactly_one_uploader check (num_nonnulls(uploader_guest_id, uploader_host_id) = 1)
);
comment on table reports is
  'Harmful evidence = reason harmful AND status in (upheld, auto_held). It keeps the reporter, '
  'reviewer, uploader and content_hash after the media and event are purged. status auto_held is '
  'called "auto-resolved" in the spec.';
create unique index reports_one_open_per_guest_media_key
  on reports (media_id, reporter_guest_id) where status = 'open' and reporter_guest_id is not null;
create index reports_reporter_event_created_idx on reports (reporter_guest_id, event_id, created_at);
create index reports_event_status_idx on reports (event_id, status);
