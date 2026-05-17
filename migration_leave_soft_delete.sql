-- Add soft delete columns to leave_requests table
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
