-- Migration: Fix Profiles RLS Loop
-- Description: Ensures users can read their own profile to log in

-- 1. Remove the problematic policies
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;

-- 2. Create a clean "View Own Profile" policy (Always allowed for the owner)
CREATE POLICY "profiles_view_own" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 3. Create a clean "Admin View All" policy (Allows HR/Admin/Super Admin to see everyone)
-- We use a subquery that doesn't loop
CREATE POLICY "profiles_admin_view_all" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role')::text IN ('hr', 'admin', 'super_admin')
  )
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('hr', 'admin', 'super_admin')
);

-- 4. Ensure Super Admin can UPDATE roles
CREATE POLICY "super_admin_manage_roles" ON public.profiles
FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);
