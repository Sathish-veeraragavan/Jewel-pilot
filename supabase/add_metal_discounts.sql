-- Add Metal-Specific Shop Discounts JSONB column to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS metal_discounts JSONB DEFAULT '{}'::jsonb;
