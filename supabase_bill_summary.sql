
-- Egress optimization: compact bill metadata used by history/share cards.
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS summary JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS bills_user_created_at_idx ON public.bills (user_id, created_at DESC);
