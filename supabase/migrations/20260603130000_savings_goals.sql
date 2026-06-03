-- Savings goals: household-visible targets (e.g. "New Car", "Emergency fund").
-- Admins manage them; all household members can view progress.

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  target_amount   numeric NOT NULL CHECK (target_amount > 0),
  current_amount  numeric NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  created_by      uuid NOT NULL DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household view savings goals" ON public.savings_goals;
CREATE POLICY "household view savings goals"
  ON public.savings_goals FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));

DROP POLICY IF EXISTS "admins insert savings goals" ON public.savings_goals;
CREATE POLICY "admins insert savings goals"
  ON public.savings_goals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update savings goals" ON public.savings_goals;
CREATE POLICY "admins update savings goals"
  ON public.savings_goals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete savings goals" ON public.savings_goals;
CREATE POLICY "admins delete savings goals"
  ON public.savings_goals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
