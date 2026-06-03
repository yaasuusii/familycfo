-- Reimbursable expenses: cash spent on work travel/meetups that gets paid back.
-- Pending = still out of pocket (counts as real spend).
-- Received = paid back; nets to zero (excluded from real spend) and an offsetting
--            "Reimbursement" income row records the cash inflow.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_reimbursable boolean NOT NULL DEFAULT false;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reimbursement_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_reimbursement_status_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_reimbursement_status_check
  CHECK (reimbursement_status IN ('none', 'pending', 'received'));

-- Allow "Reimbursement" as an income source for the offsetting payback row.
ALTER TABLE public.income DROP CONSTRAINT IF EXISTS income_source_check;
ALTER TABLE public.income ADD CONSTRAINT income_source_check
  CHECK (source IN ('Salary', 'Business', 'Loan Taken', 'Reimbursement', 'Other'));
