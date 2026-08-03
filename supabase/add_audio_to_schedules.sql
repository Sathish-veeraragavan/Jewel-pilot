-- Migration: Add audio_track_id column to public.schedules table
ALTER TABLE public.schedules 
  ADD COLUMN IF NOT EXISTS audio_track_id uuid REFERENCES public.music_tracks(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_schedules_audio_track ON public.schedules(audio_track_id);
