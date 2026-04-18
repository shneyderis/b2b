-- Phase 1 follow-up: warehouses.
--
-- 1. Adds a 'warehouse' value to the user_role enum.
-- 2. Creates a warehouses table with one default row ('Головний склад').
-- 3. Adds partners.warehouse_id (FK → warehouses) and backfills all existing
--    partners to the default warehouse.
-- 4. Adds users.warehouse_id (FK → warehouses), nullable; set only for
--    warehouse-staff users created from the admin UI.
--
-- Idempotent via IF NOT EXISTS. Paste into the Supabase SQL Editor and Run.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'warehouse';

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO warehouses (name)
SELECT 'Головний склад'
WHERE NOT EXISTS (SELECT 1 FROM warehouses);

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

UPDATE partners
   SET warehouse_id = (SELECT id FROM warehouses ORDER BY created_at LIMIT 1)
 WHERE warehouse_id IS NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
