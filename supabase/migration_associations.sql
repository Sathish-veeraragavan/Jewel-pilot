-- Migration: Multi-Tenant Rate Associations
-- Run this in the Supabase SQL Editor

-- 1. Create associations table
CREATE TABLE IF NOT EXISTS associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state_id UUID REFERENCES states(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Modify gold_rates: link to association
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES associations(id) ON DELETE CASCADE;

-- 3. Drop old unique date constraint
ALTER TABLE gold_rates DROP CONSTRAINT IF EXISTS gold_rates_rate_date_key;

-- 4. Add compound unique constraints/indexes on (rate_date, association_id)
DROP INDEX IF EXISTS gold_rates_date_association_idx;
DROP INDEX IF EXISTS gold_rates_date_null_association_idx;

CREATE UNIQUE INDEX gold_rates_date_association_idx ON gold_rates (rate_date, association_id) WHERE association_id IS NOT NULL;
CREATE UNIQUE INDEX gold_rates_date_null_association_idx ON gold_rates (rate_date) WHERE association_id IS NULL;

-- 5. Modify shops: link to association
ALTER TABLE shops ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES associations(id) ON DELETE SET NULL;
