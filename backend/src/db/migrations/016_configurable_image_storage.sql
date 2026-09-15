-- Migration 016: Configurable image storage (local disk or S3/MinIO)
-- Adds storage_key so images can live on either backend; url becomes the
-- public-facing proxy path regardless of where the bytes are stored.

ALTER TABLE images
  ADD COLUMN IF NOT EXISTS storage_key VARCHAR(255);

UPDATE images SET storage_key = filename WHERE storage_key IS NULL;

ALTER TABLE images
  ALTER COLUMN storage_key SET NOT NULL;
