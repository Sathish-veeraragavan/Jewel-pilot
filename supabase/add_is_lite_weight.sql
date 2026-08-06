-- Migration: Add is_lite_weight column to videos table and support multiple phone numbers in shops
-- 1. Add is_lite_weight column to public.videos
ALTER TABLE public.videos 
  ADD COLUMN IF NOT EXISTS is_lite_weight boolean NOT NULL DEFAULT false;

-- 2. Alter column types in public.shops to hold multiple phone numbers (longer strings)
ALTER TABLE public.shops 
  ALTER COLUMN phone TYPE VARCHAR(100),
  ALTER COLUMN owner_phone TYPE VARCHAR(100);
