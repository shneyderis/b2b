CREATE TABLE IF NOT EXISTS pending_telegram_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  delivery_address_id UUID NOT NULL REFERENCES delivery_addresses(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_tg_user
  ON pending_telegram_orders (telegram_user_id, created_at DESC);
