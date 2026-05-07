-- EMERGENCY FIX MIGRATION
-- This script fixes all missing columns and broken relationships identified in the logs.

-- 1. FIX PROFILES TABLE
-- Ensure joined_at exists (critical for HR Dashboard)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS joined_at DATE DEFAULT CURRENT_DATE;

-- 2. FIX DEPARTMENTS TABLE
-- Ensure icon exists
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS icon TEXT;

-- 3. FIX DAILY_REPORTS TABLE & RELATIONSHIPS
-- Ensure all structured columns exist
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS tasks_planned TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS tasks_completed TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS work_in_progress TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS tomorrow_plan TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS productivity_rating INTEGER;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS additional_notes TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- CRITICAL: Establish a direct relationship between daily_reports and profiles
-- First, ensure the user_id column exists
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS user_id UUID;

-- Drop any existing FK to auth.users if it's blocking the profiles join
-- (PostgREST prefers direct relationships to the table being joined)
DO $$ 
BEGIN
    -- Drop old constraint if it exists (names can vary, so we check for column and foreign table)
    -- We'll just add a new one with a specific name.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'daily_reports' AND constraint_name = 'daily_reports_profiles_fkey'
    ) THEN
        ALTER TABLE public.daily_reports 
        ADD CONSTRAINT daily_reports_profiles_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure the unique constraint on user_id + report_date exists
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_user_id_report_date_key;
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_user_id_report_date_key UNIQUE (user_id, report_date);

-- Enable RLS and setup policies
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_self_all" ON public.daily_reports;
CREATE POLICY "reports_self_all" ON public.daily_reports FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_hr_view" ON public.daily_reports;
CREATE POLICY "reports_hr_view" ON public.daily_reports FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
  )
);

-- 4. TRIGGER FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER update_daily_reports_updated_at
    BEFORE UPDATE ON public.daily_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
