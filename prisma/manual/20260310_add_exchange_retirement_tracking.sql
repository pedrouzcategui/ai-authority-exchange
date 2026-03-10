ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS ai_authority_exchange_joined_at TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS ai_authority_exchange_retired_at TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS ai_authority_exchange_retired_in_round_batch_id INTEGER REFERENCES ai_authority_exchange_round_batches(id) ON DELETE SET NULL;

UPDATE businesses
SET ai_authority_exchange_joined_at = COALESCE(ai_authority_exchange_joined_at, NOW())
WHERE is_active_on_ai_authority_exchange = TRUE
  AND ai_authority_exchange_joined_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_retired_round_batch_id
  ON businesses(ai_authority_exchange_retired_in_round_batch_id);