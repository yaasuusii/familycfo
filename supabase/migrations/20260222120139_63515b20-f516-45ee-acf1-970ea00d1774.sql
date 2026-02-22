
-- Create recurring_income table
CREATE TABLE public.recurring_income (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  amount numeric NOT NULL,
  frequency text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  auto_post boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recurring income" ON public.recurring_income FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert recurring income" ON public.recurring_income FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update recurring income" ON public.recurring_income FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete recurring income" ON public.recurring_income FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Create recurring_expenses table
CREATE TABLE public.recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  frequency text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  auto_post boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recurring expenses" ON public.recurring_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert recurring expenses" ON public.recurring_expenses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update recurring expenses" ON public.recurring_expenses FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete recurring expenses" ON public.recurring_expenses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add tracking columns to income table
ALTER TABLE public.income ADD COLUMN is_auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.income ADD COLUMN recurring_id uuid;

-- Add tracking columns to expenses table
ALTER TABLE public.expenses ADD COLUMN is_auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN recurring_id uuid;
