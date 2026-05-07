-- Migration to update daily_reports table and fix missing department icons
-- 1. FIX DEPARTMENTS TABLE
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS icon TEXT;

-- 2. UPDATE DAILY_REPORTS TABLE
-- Ensure the columns exist for structured reporting
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS tasks_planned TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS tasks_completed TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS work_in_progress TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS tomorrow_plan TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS productivity_rating INTEGER;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS additional_notes TEXT;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. FIX RELATIONSHIPS (PostgREST Join Error fix)
-- Ensure user_id is a foreign key to profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'daily_reports' AND constraint_type = 'FOREIGN KEY' 
        AND constraint_name = 'daily_reports_user_id_fkey'
    ) THEN
        ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. CONSTRAINTS & RLS
-- Ensure the unique constraint on user_id + report_date exists
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_user_id_report_date_key;
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_user_id_report_date_key UNIQUE (user_id, report_date);

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "reports_self_all" ON public.daily_reports;
CREATE POLICY "reports_self_all" ON public.daily_reports FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_hr_view" ON public.daily_reports;
CREATE POLICY "reports_hr_view" ON public.daily_reports FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
  )
);

-- 5. TRIGGER FOR updated_at
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
