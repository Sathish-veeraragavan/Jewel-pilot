-- Add Regional Rate Labels Toggle to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS use_regional_rate_labels BOOLEAN DEFAULT false NOT NULL;
