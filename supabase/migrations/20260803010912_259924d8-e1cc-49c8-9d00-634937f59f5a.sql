ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS scene_image_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS audio_path text;