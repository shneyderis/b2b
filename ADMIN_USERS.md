# Partner-user operations

This doc covers two related surfaces that landed in Phase 2+:

1. **Admin-side user management** on `/admin/partners` — add, edit, delete
   partner logins and generate a fresh password for any of them.
2. **Self-service password reset** — a partner clicks «Забули пароль?» on
   the email login screen, gets a reset link in their Telegram DM, and
   sets a new password without waiting for a manager.

Both live behind the `users` table. A partner can have any number of
`users` rows (distinct emails, same `partner_id`), and every operation
below is scoped to `role = 'partner'` so admins can't accidentally
mutate warehouse or other admin rows through the partner routes.

## Admin UI

`/admin/partners → Показати деталі → Користувачі`. Each user row has:

| Button | Action |
|---|---|
| **Ред.** | Opens a modal to edit `email`, `contact_name`, `phone`. 409 if the new email already exists elsewhere. |
| **Пароль** | Confirms, then `POST …/reset-password`. Backend returns the plaintext once; the UI shows it in a modal with a copy button. Closing the modal is the only thing that hides the password — nothing is persisted that can be re-read. |
| **✕** | Delete the login. Hidden when this is the partner's last user (prevents orphan partners). 409 `self_delete` if the caller is deleting their own row. |

`+ Додати` above the list is the existing "add login" modal and is
unchanged.

## Backend endpoints

All require `Authorization: Bearer <admin token>`; `requireAdmin` lives
on the router prefix.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/admin/partners/:pid/users` | Add a login. 409 if email taken. |
| `PUT`  | `/api/admin/partners/:pid/users/:uid` | Edit email / phone / contact_name. 404 if the user isn't on that partner. 409 if the new email collides with another row. Accepts `null` for phone / contact_name (distinguished from "omitted" by presence of the key in the JSON body). |
| `DELETE` | `/api/admin/partners/:pid/users/:uid` | 409 `last_user` if this would leave the partner with zero users. 409 `self_delete` if the caller is deleting their own row. |
| `POST` | `/api/admin/partners/:pid/users/:uid/reset-password` | Generates a 10-char password from an unambiguous alphabet (no `0OoIl1`), bcrypt-hashes it, writes to `users.password_hash`, returns `{password}` once. |

Password generation uses `crypto.randomBytes(10)` and maps each byte into
`ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` by modulo — a
tiny bias for an already-short password is fine.

## Self-service password reset

### Flow

1. Partner opens `/login` → clicks «Забули пароль?».
2. Enters email → `POST /api/auth/forgot-password { email }`.
3. Backend looks up the user. **Always** returns `{ok:true}` so an
   attacker can't enumerate registered emails by probing this route.
4. If the user exists **and** has a linked `telegram_id`, a 32-byte
   random token is generated, sha256-hashed into
   `password_reset_tokens`, and the plaintext is sent to the partner as
   a Telegram DM:

   > `<base>/reset-password?token=…`

   where `<base>` is `TELEGRAM_MINIAPP_URL`. If that env var is empty,
   the token is still stored but the DM is skipped — callers without a
   deploy URL have to build the link themselves.

5. Partner taps the link (mini-app or browser), enters + confirms a new
   password, `POST /api/auth/reset-password { token, password }`.
6. Backend hashes the submitted token, finds the row, validates
   `used_at IS NULL` and `expires_at > NOW()`, updates
   `users.password_hash`, marks the token used, and also invalidates
   every other outstanding token for that user in the same transaction.

### Why Telegram and not email

The app has no SMTP provider and every partner is already a Telegram
user (inbound onboarding + outbound order notifications all ride the
bot). Reusing the bot means zero new infra and a channel that the
partner already trusts as "coming from the winery".

The tradeoff: partners who signed up by email and never linked Telegram
can't self-reset. They have to go through an admin, who can click
«Пароль» on their user row and read them the generated password.

### Token lifetime and security

- TTL: **30 minutes**.
- Single-use: `used_at` is set on consumption, and a successful reset
  also invalidates every other unused token for that user (defence
  against the case where a partner clicked «Forgot password» twice in
  two tabs).
- Only `sha256(token)` is stored in DB. A full DB dump (backup leak,
  SQL-injection readout) isn't enough to take over an account — you
  also need the plaintext token, which only lives in the partner's
  Telegram chat.
- Cron prunes rows older than 1 day (the daily `/api/cron/cleanup`
  job). Anything that old is definitely used or expired.

### Error codes

`POST /api/auth/reset-password` returns 400 with one of:

| `error` | Meaning |
|---|---|
| `invalid_token` | No row matches the hash. |
| `token_used` | Row exists but `used_at` is set. |
| `token_expired` | `expires_at < NOW()`. |
| `invalid input` | Zod rejected the body (missing token or password < 6 chars). |

The frontend (`web/src/pages/ResetPassword.tsx`) surfaces these as
Ukrainian messages:

- *Посилання застаріло. Запросіть нове.*
- *Це посилання вже використано.*
- *Посилання недійсне.*

## Migrations

- Server runner: `server/migrations/007_password_reset_tokens.sql`
- Manual (Supabase SQL Editor): `sql/manual-setup/012_password_reset_tokens.sql`

Both create `password_reset_tokens` with `token_hash UNIQUE`, indexes on
`user_id` and `expires_at`, and `ON DELETE CASCADE` from `users` so
deleting a user also drops their pending tokens.
