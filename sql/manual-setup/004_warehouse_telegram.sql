-- Phase 1 follow-up: per-warehouse Telegram chat for order notifications.
--
-- Nullable column. When set, orders flipped to status='confirmed' trigger
-- a message to this chat id (group, channel username, or numeric id).
-- Idempotent — safe to re-run.

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64);
