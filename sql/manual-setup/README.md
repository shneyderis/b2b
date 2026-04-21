# Manual Supabase setup (one-time)

Ready-to-paste SQL for the Supabase SQL Editor. Use this when you can't run
`npm run -w server migrate && seed` locally (no Node toolchain). Everything
below is a copy of what those scripts do, with bcrypt password hashes for
`admin123` and `partner123` pre-computed.

## Order

1. **Supabase → SQL Editor → New query** → paste `001_init.sql` → **Run**.
   Creates extensions, enums, and all tables. Idempotent (`IF NOT EXISTS`).
2. **New query** → paste `002_seed.sql` → **Run**. Wipes the tables and
   populates them with the demo dataset (admin, 19 wines, 4 partners incl.
   1 pending, addresses, 6 demo orders in various statuses).
3. **Each subsequent numbered file** (`003_…` through `012_…`) is an
   incremental schema change — paste and run in filename order. All are
   idempotent. You only need to re-run the ones newer than what's already
   on the database.

Both `001` and `002` run inside a single transaction each — any error
rolls back.

### Recent migrations

| File | What it does |
|---|---|
| `003_warehouses.sql` / `004_warehouse_telegram.sql` | Multi-warehouse support + per-warehouse Telegram chat. |
| `005_…` / `006_wines_full.sql` | Wine metadata refresh + full catalog columns. |
| `007_partners_city.sql` | `partners.city`. |
| `008_telegram_pending_orders.sql` | Staging table for bot-confirmed orders. |
| `009_partners_legal_name.sql` | `partners.legal_name` (printed on PDFs). |
| `010_partners_trgm.sql` | `pg_trgm` index for fuzzy partner lookup in the bot. |
| `011_users_telegram_unique.sql` | Nullifies duplicate `telegram_id`s (admin > warehouse > partner) and adds `UNIQUE` constraint. Safe to re-run. |
| `012_password_reset_tokens.sql` | Table for self-service «Забули пароль?» tokens. Required by `/api/auth/forgot-password`. |

## Credentials after seed

- Admin: `admin@winery.com` / `admin123`
- Partner (approved): `chaika@example.com` / `partner123`
- Partner (pending — login must be rejected): `terasa@example.com` / `partner123`

## Re-running

- `001_init.sql` is safe to re-run.
- `002_seed.sql` wipes all tables first — do **not** run in production after
  real data exists.

## How this file was generated

`002_seed.sql` was produced from `server/scripts/seed.ts` by a one-shot
generator that imports `bcryptjs` to compute password hashes and emits the
same INSERTs the TypeScript version runs. The generator itself is not
committed — regenerate by running the TS seed locally whenever possible.
