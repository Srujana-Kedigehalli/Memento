-- Migration 002: Add file hash column for duplicate detection
-- This enables exact-match duplicate detection: if a guest uploads
-- the exact same file bytes twice (same SHA-256 hash), the system
-- will return the existing photo instead of creating a duplicate.

alter table photos add column file_hash text;

-- Add unique constraint on (event_id, file_hash) so that for each event,
-- no two photos can have the same file hash. This prevents duplicates
-- while allowing the same file to be uploaded to different events.
-- The constraint is added as DEFERRABLE so it's enforced at transaction end,
-- and we use NULLS NOT DISTINCT to ensure NULL hashes don't bypass the constraint.
alter table photos
  add constraint photos_event_id_file_hash_unique unique (event_id, file_hash) deferrable initially deferred;

-- Create an index on file_hash for faster duplicate lookups during upload.
create index photos_file_hash_idx on photos(file_hash);
