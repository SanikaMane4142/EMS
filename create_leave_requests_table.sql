-- Migration: Create Leave Requests Table
-- Description: Sets up the professional leave management system

-- 1. Create the table
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

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;

-- 3. Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Employees can view only their own requests
CREATE POLICY "employees_view_own" ON public.leave_requests
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Employees can create their own requests
CREATE POLICY "employees_create_own" ON public.leave_requests
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- HR/Admin/Super Admin can view and manage all requests
CREATE POLICY "admins_manage_all" ON public.leave_requests
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
  )
);

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
