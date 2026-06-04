
-- allowed_emails: explicit admin-only SELECT
DROP POLICY IF EXISTS "Admins can view allowed emails" ON public.allowed_emails;
CREATE POLICY "Admins can view allowed emails"
  ON public.allowed_emails
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- profiles: limit SELECT to own row
DROP POLICY IF EXISTS "Household members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- user_roles: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
