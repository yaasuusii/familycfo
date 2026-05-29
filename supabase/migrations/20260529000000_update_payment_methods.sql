-- Drop old CHECK constraint first so existing data can be migrated freely
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;

-- Update payment_method values: Bank → CBE, Telebirr → 127
UPDATE public.expenses SET payment_method = 'CBE' WHERE payment_method = 'Bank';
UPDATE public.expenses SET payment_method = '127' WHERE payment_method = 'Telebirr';

-- Add the new CHECK constraint
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_payment_method_check
  CHECK (payment_method IN ('Cash', 'CBE', 'BOA', '127'));

-- Update loan repayment trigger: default payment method from 'Bank' to 'CBE'
CREATE OR REPLACE FUNCTION public.process_loan_repayment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_remaining numeric;
  loan_record RECORD;
BEGIN
  SELECT * INTO loan_record FROM public.loans WHERE id = NEW.loan_id;
  new_remaining := loan_record.remaining_balance - NEW.amount_paid;
  IF new_remaining < 0 THEN new_remaining := 0; END IF;
  NEW.remaining_balance := new_remaining;
  UPDATE public.loans
    SET remaining_balance = new_remaining,
        status = CASE WHEN new_remaining <= 0 THEN 'closed' ELSE 'active' END
    WHERE id = NEW.loan_id;
  IF loan_record.loan_type = 'taken' THEN
    INSERT INTO public.expenses (user_id, date, category, amount, payment_method, notes)
    VALUES (NEW.created_by, NEW.payment_date, 'Loan Repayment', NEW.amount_paid, 'CBE',
            'Loan repayment to ' || loan_record.lender_or_borrower_name);
  END IF;
  RETURN NEW;
END;
$$;
