-- Fix: budgets should be unique per (category, month, year), NOT per category alone.
--
-- The budgets table was originally created with `category TEXT NOT NULL UNIQUE`,
-- which generated the single-column constraint `budgets_category_key`. Migration
-- 20260220112441 added the correct composite constraint
-- `budgets_category_month_year_unique (category, month, year)` but left the old
-- one in place. As a result, setting the same category in a second month fails
-- with "duplicate key value violates unique constraint budgets_category_key".
--
-- Drop the stale single-column constraint so each category can have its own
-- budget in every month/year.
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_category_key;
