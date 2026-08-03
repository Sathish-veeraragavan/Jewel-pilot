-- Migration: Dynamic Rate Placeholders and Template Categorization
-- Run this in the Supabase SQL Editor

-- 1. Add rate_18k and rate_9k columns to gold_rates
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS rate_18k NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS rate_9k NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- 2. Add selected_rates column to shops (defaults to 22K 1g, 22K 8g, and Silver 1g)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS selected_rates TEXT[] DEFAULT ARRAY['rate_22k_1g', 'rate_22k_8g', 'rate_silver_1g']::TEXT[];

-- 3. Add placeholder_count column to templates (defaults to 3)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS placeholder_count INT NOT NULL DEFAULT 3;
