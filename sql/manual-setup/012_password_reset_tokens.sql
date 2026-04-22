-- Self-service password reset. A user clicks «Забули пароль?» on the
-- email login form, we look them up by email, and if they have a linked
-- telegram_id, we DM them a reset link. The plaintext token never lands
-- in the DB — only sha256(token) does — so a leaked backup can't be
-- used to take over accounts.
--
-- Tokens expire after 30 minutes and are single-use; used_at is set
-- when the /auth/reset-password endpoint consumes them.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);
