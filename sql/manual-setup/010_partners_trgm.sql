-- Fuzzy partner search via pg_trgm. The Telegram bot's LLM parser returns a
-- hint like "артанія"; ILIKE misses typos and declensions like "артаніі",
-- "artania". findPartnersByHint tries ILIKE first and falls back to trigram
-- similarity (> 0.3) on name and legal_name, ordered by best score.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_partners_name_trgm
  ON partners USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_partners_legal_name_trgm
  ON partners USING gin (lower(legal_name) gin_trgm_ops);
