-- Add is_demo and demo_metadata columns to render_jobs table
ALTER TABLE public.render_jobs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.render_jobs ADD COLUMN IF NOT EXISTS demo_metadata JSONB DEFAULT NULL;
