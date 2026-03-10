ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS is_active_on_ai_authority_exchange BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundBatchStatus') THEN
    CREATE TYPE "RoundBatchStatus" AS ENUM ('draft', 'applied');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundAssignmentSource') THEN
    CREATE TYPE "RoundAssignmentSource" AS ENUM ('auto', 'manual');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_authority_exchange_round_batches (
  id SERIAL PRIMARY KEY,
  sequence_number INTEGER NOT NULL UNIQUE,
  status "RoundBatchStatus" NOT NULL DEFAULT 'draft',
  applied_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_authority_exchange_round_assignments (
  id SERIAL PRIMARY KEY,
  round_batch_id INTEGER NOT NULL REFERENCES ai_authority_exchange_round_batches(id) ON DELETE CASCADE,
  host_business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE NO ACTION,
  guest_business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE NO ACTION,
  source "RoundAssignmentSource" NOT NULL DEFAULT 'auto',
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_round_assignment_host UNIQUE (round_batch_id, host_business_id),
  CONSTRAINT unique_round_assignment_guest UNIQUE (round_batch_id, guest_business_id),
  CONSTRAINT unique_round_assignment_pair UNIQUE (round_batch_id, host_business_id, guest_business_id)
);

ALTER TABLE ai_authority_exchange_matches
ADD COLUMN IF NOT EXISTS round_batch_id INTEGER REFERENCES ai_authority_exchange_round_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_round_assignments_round_batch_id
  ON ai_authority_exchange_round_assignments(round_batch_id);

CREATE INDEX IF NOT EXISTS idx_matches_round_batch_id
  ON ai_authority_exchange_matches(round_batch_id);