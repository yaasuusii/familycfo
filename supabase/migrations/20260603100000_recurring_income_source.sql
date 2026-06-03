-- Recurring income rules previously had no `source`, so the auto-post job wrote
-- source = the rule title. The income.source CHECK only allows a fixed set, so
-- any custom title silently failed the insert and no income was ever posted.
-- Add a proper source column constrained to the same allowed set.

ALTER TABLE public.recurring_income
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Other';

ALTER TABLE public.recurring_income DROP CONSTRAINT IF EXISTS recurring_income_source_check;
ALTER TABLE public.recurring_income ADD CONSTRAINT recurring_income_source_check
  CHECK (source IN ('Salary', 'Business', 'Loan Taken', 'Reimbursement', 'Other'));
