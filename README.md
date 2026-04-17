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
- `GET/PUT  /api/profile`
- `GET/POST/PUT/DELETE /api/addresses`
- `GET     /api/wines`
- `GET/POST/PUT/DELETE /api/orders`, `GET /api/orders/:id/pdf`
- `GET     /api/admin/orders`, `PUT /api/admin/orders/:id`, `PUT /api/admin/orders/:id/status`, `DELETE /api/admin/orders/:id`, `GET /api/admin/orders/:id/pdf`
- `GET/POST/PUT /api/admin/wines`
- `GET/POST/PUT /api/admin/partners`, `PUT /api/admin/partners/:id/status` (approve / reject)

## Deploy

`vercel.json` serves the Vite build from `web/dist` and mounts API routes as
serverless functions.

See **`INSTALL_PWA.md`** for partner-facing install instructions (iOS / Android).
