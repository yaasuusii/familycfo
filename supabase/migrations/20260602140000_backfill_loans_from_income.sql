-- Backfill a loan record for every existing "Loan Taken" income entry.
-- Going forward the app auto-creates the loan when the income is added; this
-- one-time backfill covers rows that predate that behaviour.
-- Idempotent: skips income rows that already have a matching taken-loan
-- (same principal + start_date).

INSERT INTO public.loans (
  loan_type,
  lender_or_borrower_name,
  principal_amount,
  interest_rate,
  total_amount_due,
  start_date,
  end_date,
  repayment_frequency,
  status,
  remaining_balance,
  created_by
)
SELECT
  'taken',
  COALESCE(
    NULLIF(trim(substring(i.notes from 'from\s+([^|]+)')), ''),
    'Loan via ' || COALESCE(i.payment_method, 'account')
  ),
  i.amount,
  0,
  i.amount,
  i.date,
  NULL,
  'monthly',
  'active',
  i.amount,
  i.user_id
FROM public.income i
WHERE i.source = 'Loan Taken'
  AND NOT EXISTS (
    SELECT 1 FROM public.loans l
    WHERE l.loan_type = 'taken'
      AND l.principal_amount = i.amount
      AND l.start_date = i.date
  );
