-- One telegram account = one users row. Before this, it was possible (and
-- happened in practice) for the same telegram_id to be linked both to an
-- admin and a partner row, which made /auth/telegram pick whichever row
-- came first. The resolver in auth.ts now prefers admin > warehouse >
-- partner, but we still want a hard guarantee that a telegram_id can never
-- sit on two rows at once.
--
-- Step 1–3 nullify duplicates deterministically before the constraint is
-- added, so the migration is safe to run on data that already has
-- conflicts: admin wins over warehouse wins over partner; ties within a
-- single role are broken by created_at (earliest survives).

UPDATE users SET telegram_id = NULL
 WHERE role = 'partner'
   AND telegram_id IS NOT NULL
   AND telegram_id IN (
     SELECT telegram_id FROM users
      WHERE telegram_id IS NOT NULL
        AND role IN ('admin', 'warehouse')
   );

UPDATE users SET telegram_id = NULL
 WHERE role = 'warehouse'
   AND telegram_id IS NOT NULL
   AND telegram_id IN (
     SELECT telegram_id FROM users
      WHERE telegram_id IS NOT NULL
        AND role = 'admin'
   );

UPDATE users u1 SET telegram_id = NULL
 WHERE u1.telegram_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM users u2
      WHERE u2.telegram_id = u1.telegram_id
        AND u2.id <> u1.id
        AND u2.created_at < u1.created_at
   );

ALTER TABLE users
  ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id);
