# Wine Ordering System (HoReCa)

PWA + Telegram Mini App for partners to order wines from the winery.
Shared backend with a back-office for warehouse managers.

## Stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS
- **Telegram Mini App:** same React build, uses `@twa-dev/sdk`
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Supabase-compatible)
- **PDF:** `pdfkit`
- **Auth:** email + password (bcrypt + JWT); Telegram `initData` validation
- **Deploy:** Vercel (static web + serverless API)

## Layout

```
server/       Express API + migrations + seed
web/          Vite React app (PWA + TMA)
```

## Quick start

```bash
# 1. Create a Postgres DB (local or Supabase) and copy env
cp .env.example .env
# fill DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN…

# 2. Install
npm install --workspaces

# 3. Apply schema & seed
npm run -w server migrate
npm run -w server seed

# 4. Run API + web in parallel
npm run -w server dev   # :3001
npm run -w web    dev   # :5173 (proxy to :3001)
```

Seed admin: `admin@winery.com` / `admin123`.

## API surface

See `server/src/routes/*`. Summary:

- `POST /api/auth/login`, `POST /api/auth/telegram`
- `GET/PUT /api/profile`
- `GET/POST/PUT/DELETE /api/addresses`
- `GET /api/wines`
- `GET/POST/PUT/DELETE /api/orders`
- `POST /api/messages`
- `GET /api/admin/orders`, `PUT /api/admin/orders/:id/status`, `GET /api/admin/orders/:id/pdf`
- `GET/POST/PUT /api/admin/wines`, `GET/POST/PUT /api/admin/partners`
- `POST /api/admin/broadcast`

## Deploy

`vercel.json` is pre-configured: the web app builds to `web/dist`, API routes
are mounted from `server/api/*` (serverless functions).
