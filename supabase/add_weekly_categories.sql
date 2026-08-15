-- Migration: Add weekly_categories to shops table
-- Run this in your Supabase SQL Editor or execute it directly

ALTER TABLE shops ADD COLUMN IF NOT EXISTS weekly_categories JSONB DEFAULT NULL;
