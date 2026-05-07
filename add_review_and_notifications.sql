-- MIGRATION: ADD REVIEW SYSTEM & NOTIFICATIONS
-- 1. Update daily_reports table with review fields
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_self_select" ON public.notifications;
CREATE POLICY "notifications_self_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_self_update" ON public.notifications;
CREATE POLICY "notifications_self_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- HR/Admin can create notifications for anyone
DROP POLICY IF EXISTS "notifications_hr_insert" ON public.notifications;
CREATE POLICY "notifications_hr_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
  )
);
DROP POLICY IF EXISTS "reports_hr_update" ON public.daily_reports;
CREATE POLICY "reports_hr_update" ON public.daily_reports FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
  )
);
