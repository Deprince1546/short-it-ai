ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS attempt integer;
CREATE INDEX IF NOT EXISTS generation_events_correlation_id_idx ON public.generation_events (correlation_id);
CREATE INDEX IF NOT EXISTS generations_correlation_id_idx ON public.generations (correlation_id);