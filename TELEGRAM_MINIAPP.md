# Telegram Mini App — Phase 2

Phase 2 reuses the Phase 1 React PWA build and loads it inside Telegram as a
Mini App. Partners open the bot, tap **«Відкрити каталог»**, and either land
straight in the catalog (if their Telegram account is already linked to an
approved partner) or fill a short onboarding form (company name + phone).

## 1. Prerequisites

- Phase 1 is deployed and reachable over **HTTPS** (Telegram requires TLS for
  Mini Apps). Current production URL: `https://b2b-liard.vercel.app`.
- `TELEGRAM_BOT_TOKEN` is set in Vercel env (same token that already drives
  Phase 1 outbound notifications). No new env vars are needed.

## 2. BotFather setup

Open [@BotFather](https://t.me/BotFather) and run the commands below. Replace
`https://b2b-liard.vercel.app` with your production domain if different.

### 2a. Menu button (recommended)

The menu button is the blue "WebApp" button to the left of the message input.

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

## 3. How auth works

1. `index.html` loads `telegram-web-app.js`, so `window.Telegram.WebApp.initData`
   is present whenever the page is rendered inside Telegram.
2. On mount, `web/src/auth.tsx` posts the raw `initData` to
   `POST /api/auth/telegram`.
3. The server validates the payload per [Validating data received via the Mini
   App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
   - `secret_key = HMAC_SHA256("WebAppData", TELEGRAM_BOT_TOKEN)`
   - `data_check_string` = all `key=value` pairs except `hash`, sorted by key
     and joined with `\n`
   - compare `hex(HMAC_SHA256(secret_key, data_check_string))` to the received
     `hash` using `crypto.timingSafeEqual`
   - reject if `auth_date` is older than 24 hours
4. Response from `POST /api/auth/telegram`:
   - **`200 { token, role }`** — a `users.telegram_id` row exists and partner
     is approved. JWT is stored in `localStorage`, user lands on the catalog.
   - **`403 partner_not_approved`** — Telegram account is already linked but
     partner is pending/rejected. UI shows a waiting-for-approval screen.
   - **`404 not_linked`** — no user with this `telegram_id` yet. UI renders
     the onboarding form (company name + phone) and posts to
     `POST /api/auth/telegram/onboard`.
5. Onboarding (`POST /api/auth/telegram/onboard`) re-validates `initData`,
   then:
   - Searches `users` where `telegram_id IS NULL` and the last 9 digits of
     `users.phone` match the submitted phone. If **exactly one** unlinked
     partner matches → writes `telegram_id` on that user. If the partner is
     already approved, the response is `200` with a JWT (instant entry next
     open); if still pending, `403 partner_not_approved`.
   - Otherwise → creates a new `partners` row (status `pending`) with the
     submitted `company_name`, and a `users` row with the phone, Telegram
     display name, a placeholder email (`tg<id>@telegram.pending`) and
     `telegram_id`. Returns `403 partner_not_approved`.
6. The admin back-office (`/admin/partners`) is the canonical place to
   approve partners — the flow is identical to the email/password signup.

### Phone matching rule

Only the **last 9 digits** are compared, after stripping all non-digit
characters. So `+380 50 123 45 67`, `0501234567`, and `380501234567` all
match `501234567`. This is intentionally loose to handle Ukrainian numbers
entered with or without the country code.

If two or more unlinked partners happen to share the same trailing 9 digits,
auto-match is skipped and a new pending record is created — admin resolves
the ambiguity manually.

## 4. Linking an existing partner to a Telegram account

The automatic linkage in §3.5 only fires when a partner was pre-created in
the admin back-office with a matching phone, and the partner has no
`telegram_id` yet. If the auto-match fails (phone differs, typo, already
linked to a different Telegram account, etc.), admin can link manually:

```sql
-- copy the telegram_id onto the real account
UPDATE users
   SET telegram_id = (
     SELECT telegram_id FROM users WHERE email = 'tg<ID>@telegram.pending'
   )
 WHERE email = 'partner@example.com';

-- drop the placeholder partner + user created by the Mini App
DELETE FROM partners WHERE id = (
  SELECT partner_id FROM users WHERE email = 'tg<ID>@telegram.pending'
);
```

A proper merge UI is tracked for a later phase.

## 5. Phone input — why manual for now

Telegram's Mini App `initData` exposes only `id`, `first_name`, `last_name`,
`username`, `language_code`, `photo_url` — **no phone**. The only way to
obtain a phone number inside a Mini App is `Telegram.WebApp.requestContact()`,
whose confirmation is delivered as a bot update (webhook), not to the Mini
App itself. Phase 1 is outbound-only and has no webhook/bot service, so
Phase 2 asks the user to type the phone once during onboarding. A later
phase will introduce a bot service and wire up auto-fill via
`requestContact`.

## 6. Smoke test

1. In the Telegram app, tap the bot's **«Відкрити каталог»** button.
2. Expect one of:
   - the catalog, if `users.telegram_id = <your tg id>` is already approved;
   - «Заявка прийнята. Очікуйте на підтвердження менеджера.» if linked but
     pending;
   - the onboarding form («Назва закладу» + «Телефон») if no `telegram_id`
     match yet. Submit → same pending screen appears.
3. The admin approves the partner at `/admin/partners`. Next open of the
   Mini App logs in automatically.

## 7. Local testing

Telegram enforces HTTPS. Options:

- Deploy a Vercel preview and point the BotFather menu button URL at the
  preview domain while testing.
- Or tunnel local `web` + `server` through [ngrok](https://ngrok.com/) and
  temporarily point the menu button at the ngrok URL.

In a regular browser the site still works as a PWA — `initData` is absent
and `AuthProvider` falls back to the email/password form.
