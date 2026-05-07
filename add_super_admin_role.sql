-- Migration: Add Super Admin Role
-- Description: Updates the allowed roles in the profiles table

-- 1. Update the check constraint for roles
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'hr', 'employee'));

-- 2. Ensure RLS for profiles allows Super Admin access
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;

CREATE POLICY "admins_view_all_profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
  )
);
