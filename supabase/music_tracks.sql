-- Migration: Create public.music_tracks table for background music library
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cloudflare_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  is_active boolean DEFAULT true,
  created_at timestamp WITH time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated and anonymous users to SELECT tracks
DROP POLICY IF EXISTS "Allow public read access to music tracks" ON public.music_tracks;
CREATE POLICY "Allow public read access to music tracks" ON public.music_tracks
  FOR SELECT TO authenticated, anon USING (true);

-- Policy: Allow admins/super admins full control (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Allow admin full control on music_tracks" ON public.music_tracks;
CREATE POLICY "Allow admin full control on music_tracks" ON public.music_tracks
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'super_admin' OR profiles.role = 'admin')
    )
  );
