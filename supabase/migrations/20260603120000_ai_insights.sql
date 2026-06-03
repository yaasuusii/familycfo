-- AI-generated financial insights (forecast / budget / recurring).
-- Cache table: one row per (insight_type, period_start). The edge function
-- `financial-insights` writes with the service role; the household reads.

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type  text NOT NULL CHECK (insight_type IN ('forecast', 'budget', 'recurring')),
  period_label  text NOT NULL,
  period_start  date NOT NULL,
  payload       jsonb NOT NULL,
  model         text,
  created_by    uuid NOT NULL DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One cached insight per type per period; upserts overwrite on manual refresh.
CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_type_period_idx
  ON public.ai_insights (insight_type, period_start);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Household members may read cached insights. Writes happen via the edge
-- function (service role), so no client INSERT/UPDATE policy is needed.
DROP POLICY IF EXISTS "household read insights" ON public.ai_insights;
CREATE POLICY "household read insights" ON public.ai_insights
  FOR SELECT USING (public.is_household(auth.uid()));
