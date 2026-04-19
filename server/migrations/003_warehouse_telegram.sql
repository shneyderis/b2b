ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64);
