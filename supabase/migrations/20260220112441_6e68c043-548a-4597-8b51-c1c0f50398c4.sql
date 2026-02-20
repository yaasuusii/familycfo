
-- Add month, year, and income_target columns to budgets table
ALTER TABLE public.budgets 
  ADD COLUMN month integer NOT NULL DEFAULT EXTRACT(MONTH FROM now()),
  ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  ADD COLUMN income_target numeric;

-- Add unique constraint for one budget per category per month
ALTER TABLE public.budgets 
  ADD CONSTRAINT budgets_category_month_year_unique UNIQUE (category, month, year);
