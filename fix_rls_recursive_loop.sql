-- Migration: Final RLS Fix (No Loops)
-- Description: Uses a Security Definer function to safely check roles without recursion

-- 1. Create a helper function to check roles safely
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Clear all problematic policies
DROP POLICY IF EXISTS "profiles_admin_view_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_own" ON public.profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 3. Policy: Everyone can view their own profile (Simple, no loops)
CREATE POLICY "profiles_self_view" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 4. Policy: Admins can view all profiles (Using the safe function)
CREATE POLICY "profiles_management_view" ON public.profiles
FOR SELECT TO authenticated
USING (
  get_my_role() IN ('hr', 'super_admin')
);

-- 5. Policy: Super Admin can update any profile
CREATE POLICY "profiles_super_admin_update" ON public.profiles
FOR UPDATE TO authenticated
USING (
  get_my_role() = 'super_admin'
);
