-- Add is_resolved column to task_comments to track if a revision request has been addressed
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
