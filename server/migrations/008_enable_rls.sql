-- Enable Row Level Security on every table in the public schema.
--
-- Supabase exposes public tables through PostgREST to the anon/authenticated
-- roles. Without RLS, anyone holding the project's anon key can read and
-- write them. The app itself never goes through PostgREST — it connects as
-- the postgres role (the table owner), which bypasses RLS — so enabling RLS
-- with no policies blocks the API path and changes nothing for the server.
--
-- Dynamic so it also covers tables created by earlier migrations in any
-- order. Idempotent: ENABLE on an already-enabled table is a no-op.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')   -- ordinary + partitioned tables
       AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
