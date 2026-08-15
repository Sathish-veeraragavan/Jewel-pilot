-- Add allowed_shop_ids array column to templates table
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS allowed_shop_ids UUID[] DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_templates_allowed_shops ON public.templates USING gin (allowed_shop_ids);
