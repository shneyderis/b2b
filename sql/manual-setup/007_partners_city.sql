-- City column on partners (for filtering / statistics).
-- Nullable, idempotent.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS city VARCHAR(128);
