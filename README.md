# Wine Ordering System (HoReCa)

Minimal web app for HoReCa partners to order wines from the winery.

- **Phase 1 (this repo):** PWA for partners + back-office for managers.
- **Phase 2 (later):** Telegram Mini App reuses the same React build.

UI language: Ukrainian (українська).

## Stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS, PWA (manifest + service worker)
- **Backend:** Node.js + Express + TypeScript (deployable as Vercel serverless)
- **Database:** PostgreSQL (Supabase free tier)
- **PDF:** `pdfkit` (generated on-demand via `GET /api/orders/:id/pdf`)
- **Auth:** email + password (bcrypt + JWT)
- **Notifications:** Telegram Bot API, outbound only (no webhook, no bot service)

## Self-registration flow

1. Partner opens a registration link (distributed by the winery).
2. Fills a form: company name, contact name, phone, email, password.
3. An entry is created with `partners.status = 'pending'`.
4. Admin reviews in the back-office and approves or rejects.
5. Only `approved` partners can log in and place orders.

## Layout

```
server/       Express API + migrations + seed
web/          Vite React PWA (Ukrainian UI)
```

## Quick start

```bash
cp .env.example .env
# fill DATABASE_URL, JWT_SECRET, TELEGRAM_*, VITE_MANAGER_*

npm install --workspaces
npm run -w server migrate
npm run -w server seed       # demo partners + 19 wines + admin user
npm run -w server dev        # API on :3001
npm run -w web    dev        # Web on :5173
```

Seed admin: `admin@winery.com` / `admin123`.

## API surface

- `POST /api/auth/login`
- `POST /api/auth/register` — partner self-registration (status=pending)
- `POST /api/auth/telegram`, `POST /api/auth/telegram/onboard` — signed-initData login for the Mini App
- `POST /api/auth/forgot-password` — request a reset link (always returns `{ok:true}`)
- `POST /api/auth/reset-password` — consume the token + set a new password
- `GET/PUT  /api/profile`
- `GET/POST/PUT/DELETE /api/addresses`
- `GET     /api/wines`
- `POST /api/orders/parse` — LLM-parse partner's free-form text into catalog items
- `GET/POST/PUT/DELETE /api/orders`, `GET /api/orders/:id/pdf`
- `GET     /api/admin/orders`, `POST /api/admin/orders` (create on behalf of partner), `PUT /api/admin/orders/:id`, `PUT /api/admin/orders/:id/status`, `DELETE /api/admin/orders/:id`, `GET /api/admin/orders/:id/pdf`
- `POST /api/admin/orders/parse`, `GET /api/admin/llm-check`
- `GET/POST/PUT /api/admin/wines`
- `GET/POST/PUT /api/admin/warehouses`, `POST /api/admin/warehouse-users`
- `GET/POST/PUT /api/admin/partners`, `PUT /api/admin/partners/:id/status` (approve / reject)
- `POST /api/admin/partners/:id/users` — add a login to an existing partner
- `PUT /api/admin/partners/:pid/users/:uid` — edit email / phone / contact
- `DELETE /api/admin/partners/:pid/users/:uid` — delete; refuses last-user (409) or self (409)
- `POST /api/admin/partners/:pid/users/:uid/reset-password` — generate random password, return plaintext once
- `POST /api/telegram/webhook` — inbound updates from Telegram (admin order bot + partner confirmations)
- `GET  /api/cron/cleanup` — daily cleanup; Bearer-auth'd by `CRON_SECRET`

## Deploy (Vercel)

The root `vercel.json` builds the Vite SPA into `web/dist` and mounts the
Express app as a single serverless function at `api/[...path].ts`. The
function re-exports the Express instance returned by `createApp()` in
`server/src/index.ts`; local dev still uses `server/src/dev.ts`
(`tsx watch src/dev.ts`).

### Required Vercel env vars

| name | value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction Pooler** URL, port **6543** |
| `DIRECT_DATABASE_URL` | Supabase Direct / Session Pooler URL, port **5432** |
| `JWT_SECRET` | any long random string |
| `TELEGRAM_BOT_TOKEN` | BotFather token (outbound notifications) |
| `TELEGRAM_MANAGERS_CHAT_ID` | group id where orders are posted |
| `VITE_MANAGER_TELEGRAM_URL` | https://t.me/… (footer link) |

⚠️ **Use the Transaction Pooler for `DATABASE_URL`.** Each serverless
invocation opens its own PG client; at ~100 partners the free-tier limit
(≈60 connections) is reached in seconds without pgbouncer.
(Supabase → Settings → Database → Connection Pooling → *Transaction*.)

The migrate and seed scripts bypass pgbouncer and require
`DIRECT_DATABASE_URL` (pgbouncer in transaction mode breaks some DDL and
prepared statements).

### First deploy — run migrations against Supabase

Migrations are not run automatically on every deploy. From a checkout with
`.env` populated (or inline):

```bash
DIRECT_DATABASE_URL="postgresql://postgres.xxxx:pwd@aws-0-region.pooler.supabase.com:5432/postgres" \
  npm run -w server migrate

DIRECT_DATABASE_URL="postgresql://postgres.xxxx:pwd@aws-0-region.pooler.supabase.com:5432/postgres" \
  npm run -w server seed
```

Re-run only when schema changes. Seed wipes tables and must not be run in
production after real data exists.

### Smoke test

Local:

```bash
npm install
npm run -w web build
vercel dev       # requires Vercel CLI + `vercel link`
curl http://localhost:3000/api/health
```

Production (after deploy):

1. `GET https://<app>.vercel.app/api/health` → `{"ok":true}`
2. `POST /api/auth/login` with `admin@winery.com` / `admin123` → token
3. `GET /api/wines` with `Authorization: Bearer <token>` → 19 wines
4. Open `https://<app>.vercel.app/` → login page, then full flow

## Partner onboarding

See **[INSTALL_PWA.md](./INSTALL_PWA.md)** — short UA guide for partners on
how to add the app to their home screen (iOS Safari / Android Chrome).

## Admin partner-user ops and password reset

The admin-facing partner-user lifecycle (add / edit / delete / generate new
password) and the self-service "forgot password" flow are described in
**[ADMIN_USERS.md](./ADMIN_USERS.md)**. Migrations **007** (server runner)
/ **012** (manual Supabase) must be applied once before the forgot-password
endpoints will accept requests.

## Scheduled jobs (Vercel Cron)

`vercel.json` declares a single daily cron at 03:00 UTC that calls
`GET /api/cron/cleanup`. The endpoint requires `Authorization: Bearer
$CRON_SECRET` (Vercel injects this automatically on scheduled invokes) and
deletes:

- `pending_telegram_orders` older than 7 days, and
- `password_reset_tokens` older than 1 day (reset TTL is 30 min, so 1 day
  is well past stale for any token).

`CRON_SECRET` must be set as a plain env var in Vercel. If it's missing,
the endpoint refuses to run — safer than a world-readable cleanup route.
