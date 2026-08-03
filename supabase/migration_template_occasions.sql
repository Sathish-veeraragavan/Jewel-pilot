-- Migration: Link Templates directly to Occasions
-- Run this in the Supabase SQL Editor

ALTER TABLE templates ADD COLUMN IF NOT EXISTS occasion_id UUID REFERENCES occasions(id) ON DELETE SET NULL;
