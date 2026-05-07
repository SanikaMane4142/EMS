-- EMS FULL SCHEMA MIGRATION
-- This script sets up the entire database structure for the Employee Management System

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure manager_id column exists (handles existing tables without the column)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'manager_id') THEN
        ALTER TABLE public.departments ADD COLUMN manager_id UUID;
    END IF;
END $$;

-- 3. PROFILES TABLE (Linked to Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('employee', 'hr', 'admin', 'super_admin')) DEFAULT 'employee',
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    designation TEXT,
    phone TEXT,
    avatar_url TEXT,
    birthday DATE,
    joined_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add manager_id reference back to profiles (with existence check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_manager' AND table_name = 'departments') THEN
        ALTER TABLE public.departments ADD CONSTRAINT fk_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    punch_in_time TIMESTAMPTZ,
    punch_out_time TIMESTAMPTZ,
    total_hours DECIMAL(5,2),
    status TEXT NOT NULL CHECK (status IN ('punched_in', 'punched_out', 'auto_punched_out')) DEFAULT 'punched_in',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_day UNIQUE(user_id, attendance_date)
);

-- 5. LEAVE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    hr_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DAILY REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, report_date)
);

-- 7. ENABLE REALTIME
DO $$
BEGIN
    -- Add attendance
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    END IF;
    -- Add leave_requests
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leave_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
    END IF;
    -- Add daily_reports
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'daily_reports') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;
    END IF;
END $$;

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Helper function for role checking
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. POLICIES

-- DEPARTMENTS
DROP POLICY IF EXISTS "dept_view_all" ON public.departments;
CREATE POLICY "dept_view_all" ON public.departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dept_manage_admin" ON public.departments;
CREATE POLICY "dept_manage_admin" ON public.departments FOR ALL TO authenticated USING (get_my_role() IN ('admin', 'super_admin'));

-- PROFILES
DROP POLICY IF EXISTS "profiles_self_view" ON public.profiles;
CREATE POLICY "profiles_self_view" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_view" ON public.profiles;
CREATE POLICY "profiles_admin_view" ON public.profiles FOR SELECT TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
CREATE POLICY "profiles_admin_manage" ON public.profiles FOR ALL TO authenticated USING (get_my_role() IN ('admin', 'super_admin'));

-- ATTENDANCE
DROP POLICY IF EXISTS "attendance_self_all" ON public.attendance;
CREATE POLICY "attendance_self_all" ON public.attendance FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_hr_view" ON public.attendance;
CREATE POLICY "attendance_hr_view" ON public.attendance FOR SELECT TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- LEAVE REQUESTS
DROP POLICY IF EXISTS "leaves_self_all" ON public.leave_requests;
CREATE POLICY "leaves_self_all" ON public.leave_requests FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "leaves_hr_manage" ON public.leave_requests;
CREATE POLICY "leaves_hr_manage" ON public.leave_requests FOR ALL TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- DAILY REPORTS
DROP POLICY IF EXISTS "reports_self_all" ON public.daily_reports;
CREATE POLICY "reports_self_all" ON public.daily_reports FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_hr_view" ON public.daily_reports;
CREATE POLICY "reports_hr_view" ON public.daily_reports FOR SELECT TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));
