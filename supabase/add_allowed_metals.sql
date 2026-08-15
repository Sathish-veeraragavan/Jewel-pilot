-- Migration: Enable/Disable Precious Metal Types for Associations and Shops
-- Run this in your Supabase SQL Editor or execute it directly

-- 1. Add allowed_metals column to associations
ALTER TABLE associations ADD COLUMN IF NOT EXISTS allowed_metals TEXT[] DEFAULT ARRAY['24k', '22k', '18k', '9k', 'silver']::TEXT[];

-- 2. Add allowed_metals column to shops (NULL means inherits from association settings)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS allowed_metals TEXT[] DEFAULT NULL;
