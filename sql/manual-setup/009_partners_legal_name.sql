-- Legal-entity name for partners (e.g. "ТОВ Густозо"). The display name
-- (partners.name) may differ ("Італійська редакція"). Searches and the
-- Telegram bot match on both; PDFs print the legal name when set.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255);
