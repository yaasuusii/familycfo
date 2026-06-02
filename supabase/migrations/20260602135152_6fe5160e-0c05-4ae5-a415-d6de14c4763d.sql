-- Enable RLS on category_rules (lookup table, read-only for app)
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read category rules"
ON public.category_rules
FOR SELECT
TO authenticated
USING (true);

-- Fix mutable search_path on remaining function
ALTER FUNCTION public.auto_flag_income_self_transfer() SET search_path = public;

-- Revoke broad EXECUTE on SECURITY DEFINER trigger functions (only triggers call them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_loan_repayment() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies by signed-in users; restrict to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;