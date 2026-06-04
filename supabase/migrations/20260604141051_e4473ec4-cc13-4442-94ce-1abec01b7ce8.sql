
-- Restrict allowed_emails SELECT to admins only (admins ALL policy already exists, covers reads)
DROP POLICY IF EXISTS "Authenticated can view allowed emails" ON public.allowed_emails;

-- Restrict food_warnings reads to authenticated users only
DROP POLICY IF EXISTS "Anyone can read food warnings" ON public.food_warnings;
CREATE POLICY "Authenticated can read food warnings"
  ON public.food_warnings FOR SELECT
  TO authenticated
  USING (true);

-- Lock down SECURITY DEFINER helper from anonymous/public callers
REVOKE EXECUTE ON FUNCTION public.is_household(uuid) FROM PUBLIC, anon;
