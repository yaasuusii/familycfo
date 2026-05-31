-- Expand the default budget categories for a household and seed suggested
-- monthly amounts for Ginbot 2018 (Ethiopian month 9, year 2018), sized to a
-- ~174,000 ETB monthly salary. Amounts are placeholders meant to be edited in
-- the app. Everything is idempotent so it is safe to re-run.

-- 1. Add the new categories (skip any that already exist).
INSERT INTO public.categories (name) VALUES
  ('Savings'),
  ('Emergency'),
  ('Prenatal & Baby'),
  ('Household'),
  ('Gifts & Social'),
  ('Subscriptions'),
  ('Phone & Internet')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed suggested Ginbot 2018 budget amounts (~174,000 ETB total).
--    Skips any category that already has a budget for this month/year.
INSERT INTO public.budgets (category, monthly_limit, month, year) VALUES
  -- Essentials (~111,500)
  ('Rent',             65000, 9, 2018),
  ('Grocery',          18000, 9, 2018),
  ('Transport',         8000, 9, 2018),
  ('Prenatal & Baby',   6000, 9, 2018),
  ('Utilities',         4000, 9, 2018),
  ('Household',         4000, 9, 2018),
  ('Health',            4000, 9, 2018),
  ('Phone & Internet',  2500, 9, 2018),
  -- Debt (~10,000)
  ('Loan Repayment',   10000, 9, 2018),
  -- Lifestyle & personal (~17,000)
  ('Personal',         10000, 9, 2018),
  ('Gifts & Social',    5000, 9, 2018),
  ('Subscriptions',     2000, 9, 2018),
  -- Savings (~35,000)
  ('Savings',          25000, 9, 2018),
  ('Emergency',        10000, 9, 2018)
ON CONFLICT (category, month, year) DO NOTHING;
