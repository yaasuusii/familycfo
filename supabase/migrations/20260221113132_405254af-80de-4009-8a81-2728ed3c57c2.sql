
-- Create loans table
CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_type text NOT NULL CHECK (loan_type IN ('taken', 'given')),
  lender_or_borrower_name text NOT NULL,
  principal_amount numeric NOT NULL,
  interest_rate numeric,
  total_amount_due numeric NOT NULL,
  start_date date NOT NULL,
  end_date date,
  repayment_frequency text NOT NULL DEFAULT 'monthly' CHECK (repayment_frequency IN ('monthly', 'custom')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  remaining_balance numeric NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view loans" ON public.loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert loans" ON public.loans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update loans" ON public.loans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete loans" ON public.loans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create loan_repayments table
CREATE TABLE public.loan_repayments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_paid numeric NOT NULL,
  remaining_balance numeric NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view repayments" ON public.loan_repayments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert repayments" ON public.loan_repayments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete repayments" ON public.loan_repayments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert "Loan Repayment" category if it doesn't exist
INSERT INTO public.categories (name) 
SELECT 'Loan Repayment' WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Loan Repayment');

-- Create trigger function for loan repayment processing
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
  -- Get the loan
  SELECT * INTO loan_record FROM public.loans WHERE id = NEW.loan_id;
  
  -- Calculate new remaining balance
  new_remaining := loan_record.remaining_balance - NEW.amount_paid;
  IF new_remaining < 0 THEN
    new_remaining := 0;
  END IF;
  
  -- Set the snapshot remaining balance on the repayment
  NEW.remaining_balance := new_remaining;
  
  -- Update the loan's remaining balance
  UPDATE public.loans 
  SET remaining_balance = new_remaining,
      status = CASE WHEN new_remaining <= 0 THEN 'closed' ELSE 'active' END
  WHERE id = NEW.loan_id;
  
  -- Auto-insert expense for loan repayments on loans taken
  IF loan_record.loan_type = 'taken' THEN
    INSERT INTO public.expenses (user_id, date, category, amount, payment_method, notes)
    VALUES (NEW.created_by, NEW.payment_date, 'Loan Repayment', NEW.amount_paid, 'Bank', 
            'Loan repayment to ' || loan_record.lender_or_borrower_name);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_process_loan_repayment
BEFORE INSERT ON public.loan_repayments
FOR EACH ROW
EXECUTE FUNCTION public.process_loan_repayment();
