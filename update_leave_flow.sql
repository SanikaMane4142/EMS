-- 1. Update leave_requests status check constraint
-- First, remove the old constraint if it exists
DO $$ 
BEGIN 
    ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
END $$;

-- 2. Add new columns for tracking approvals
ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS hr_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS hr_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS super_admin_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS super_admin_action_at TIMESTAMPTZ;

-- 3. Add the new status check constraint
ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status IN ('pending_hr', 'pending_super_admin', 'approved', 'rejected'));

-- 4. Migrate existing 'pending' requests to 'pending_hr'
UPDATE public.leave_requests SET status = 'pending_hr' WHERE status = 'pending';
