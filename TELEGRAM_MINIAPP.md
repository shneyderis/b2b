# Telegram Mini App — Phase 2

Phase 2 reuses the Phase 1 React PWA build and loads it inside Telegram as a
Mini App. Partners open the bot, tap **«Відкрити каталог»**, and are
auto-logged in by the HMAC-signed `initData` that Telegram injects into the
WebView.

## 1. Prerequisites

- Phase 1 is deployed and reachable over **HTTPS** (Telegram requires TLS for
  Mini Apps). Current production URL: `https://b2b-liard.vercel.app`.
- `TELEGRAM_BOT_TOKEN` is set in Vercel env (same token that already drives
  Phase 1 outbound notifications). No new env vars are needed.

## 2. BotFather setup

Open [@BotFather](https://t.me/BotFather) and run the commands below. Replace
`https://b2b-liard.vercel.app` with your production domain if different.

### 2a. Menu button (recommended)

The menu button is the blue “WebApp” button to the left of the message input.

```
/mybots
→ <select your bot>
→ Bot Settings
→ Menu Button
→ Edit menu button URL
   Button text: Відкрити каталог
   URL:         https://b2b-liard.vercel.app/
```

### 2b. Mini App (optional — gives a `t.me/<bot>/<app>` deep link)

```
/newapp
→ <select your bot>
   Short name:   catalog
   Title:        Winery B2B
   Description:  Каталог вин для партнерів
   Photo:        <upload a 640×360 image>
   Web App URL:  https://b2b-liard.vercel.app/
```

After this completes, partners can also open the app via
`https://t.me/<bot_username>/catalog`.

## 3. How auth works

1. `index.html` loads `telegram-web-app.js`, so `window.Telegram.WebApp.initData`
   is present whenever the page is rendered inside Telegram.
2. On mount, `web/src/auth.tsx` checks `window.Telegram?.WebApp?.initData`.
   If present and no JWT is stored, it `POST`s the raw `initData` string to
   `/api/auth/telegram`.
3. The server (`server/src/routes/auth.ts`) validates the payload per
   [Validating data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
   - `secret_key = HMAC_SHA256("WebAppData", TELEGRAM_BOT_TOKEN)`
   - `data_check_string` = all `key=value` pairs except `hash`, sorted by key
     and joined with `\n`
   - compare `hex(HMAC_SHA256(secret_key, data_check_string))` to the
     received `hash` using `crypto.timingSafeEqual`
   - reject if `auth_date` is older than 24 hours
4. On success:
   - **Returning user** — a row with `users.telegram_id = <id>` exists → JWT
     is issued and returned immediately.
   - **First-time user** — a `partners` row (status `pending`) and a `users`
     row with the Telegram `id`, derived `contact_name`, and a placeholder
     email (`tg<id>@telegram.pending`) are inserted. The response is
     `403 partner_not_approved`, matching the PWA flow.
5. The PWA email/password login path is untouched. Outside Telegram
   `initData` is empty and the user sees the standard form.

## 4. Linking an existing partner to a Telegram account

Telegram’s Mini App `initData` does **not** expose email or phone — there is
no field to auto-match against `users.email` / `users.phone`. First-time
Telegram login therefore always creates a fresh `pending` record.

To link the Telegram login to an existing approved partner:

1. Ask the partner to open the Mini App once — this creates a pending
   record with the Telegram id.
2. Admin runs SQL against Supabase (no UI yet):

   ```sql
   -- copy telegram_id over to the real account
   UPDATE users
      SET telegram_id = (
        SELECT telegram_id FROM users WHERE email = 'tg<ID>@telegram.pending'
      )
    WHERE email = 'partner@example.com';

   -- drop the placeholder partner + user created by the first Mini App login
   DELETE FROM partners WHERE id = (
     SELECT partner_id FROM users WHERE email = 'tg<ID>@telegram.pending'
   );
   ```

A proper merge UI is tracked for a later phase.

## 5. Smoke test

1. In the Telegram app, tap the bot’s **«Відкрити каталог»** button.
2. Expect either:
   - the orders screen, if the Telegram account is already linked to an
     approved partner, **or**
   - the login screen with «Заявка через Telegram створена. Очікуйте на
     підтвердження менеджера.» on the first open.
3. The admin approves the partner at `/admin/partners`. Next open of the
   Mini App logs in automatically.

## 6. Local testing

Telegram enforces HTTPS. Options:

- Deploy a Vercel preview and point the BotFather menu button URL at the
  preview domain while testing.
- Or tunnel local `web` + `server` through [ngrok](https://ngrok.com/) and
  temporarily point the menu button at the ngrok URL.

In a regular browser the site still works as a PWA — `initData` is absent and
`AuthProvider` falls back to the email/password form.
