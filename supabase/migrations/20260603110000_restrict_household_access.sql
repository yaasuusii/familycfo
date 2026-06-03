-- Lock the app down to the household.
--
-- Problem: income/expenses/loans/etc. had SELECT policies of USING(true), so ANY
-- authenticated user could read all family finances. Signup is open and every new
-- user is auto-assigned the 'member' role, so anyone who found the URL could
-- register and read everything.
--
-- Fix:
--   1. An allowlist of emails (seeded from the current members).
--   2. assign_default_role only grants a role to allowlisted emails — strangers
--      get NO role.
--   3. Data policies require a household role, so a roleless stranger is fully
--      locked out (can't read or write), while existing members are unaffected.

-- 1. Allowlist table -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view allowed emails" ON public.allowed_emails;
CREATE POLICY "Authenticated can view allowed emails"
  ON public.allowed_emails FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage allowed emails" ON public.allowed_emails;
CREATE POLICY "Admins manage allowed emails"
  ON public.allowed_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed from everyone who already has a profile (the current household).
INSERT INTO public.allowed_emails (email)
  SELECT lower(email) FROM public.profiles
  ON CONFLICT (email) DO NOTHING;

-- 2. Household predicate ----------------------------------------------------
-- Anyone with any role (admin or member) is "in the household".
CREATE OR REPLACE FUNCTION public.is_household(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;

-- 3. Only grant a role to allowlisted signups -------------------------------
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
  is_allowed BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- First ever user bootstraps as admin (and is allowlisted).
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin');
    INSERT INTO public.allowed_emails (email) VALUES (lower(NEW.email))
      ON CONFLICT (email) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE email = lower(NEW.email)
  ) INTO is_allowed;

  -- Allowlisted emails become members; everyone else gets NO role and is
  -- therefore locked out of all data by the policies below.
  IF is_allowed THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'member');
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Require household membership to read/write financial data ---------------
-- INCOME
DROP POLICY IF EXISTS "Authenticated users can view income" ON public.income;
CREATE POLICY "Authenticated users can view income"
  ON public.income FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can insert income" ON public.income;
CREATE POLICY "Authenticated users can insert income"
  ON public.income FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_household(auth.uid()));

-- EXPENSES
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
CREATE POLICY "Authenticated users can insert expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_household(auth.uid()));

-- PROFILES (names + emails)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));

-- LOANS + REPAYMENTS
DROP POLICY IF EXISTS "Authenticated users can view loans" ON public.loans;
CREATE POLICY "Authenticated users can view loans"
  ON public.loans FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can view repayments" ON public.loan_repayments;
CREATE POLICY "Authenticated users can view repayments"
  ON public.loan_repayments FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));

-- RECURRING
DROP POLICY IF EXISTS "Authenticated users can view recurring income" ON public.recurring_income;
CREATE POLICY "Authenticated users can view recurring income"
  ON public.recurring_income FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can view recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Authenticated users can view recurring expenses"
  ON public.recurring_expenses FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));

-- BUDGETS
DROP POLICY IF EXISTS "Authenticated users can view budgets" ON public.budgets;
CREATE POLICY "Authenticated users can view budgets"
  ON public.budgets FOR SELECT TO authenticated
  USING (public.is_household(auth.uid()));
