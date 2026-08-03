-- Add Shop Pricing & Custom Discount Fields to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(50) DEFAULT 'default' NOT NULL;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'percentage';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS custom_rates JSONB DEFAULT '{}'::jsonb;
