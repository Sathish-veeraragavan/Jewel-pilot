-- Migration: Add keep_original_audio column to public.schedules table
ALTER TABLE public.schedules 
  ADD COLUMN IF NOT EXISTS keep_original_audio boolean NOT NULL DEFAULT false;
