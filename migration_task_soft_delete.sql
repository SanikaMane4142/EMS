-- =============================================================================
-- MIGRATION: Add soft-delete columns to task management tables
-- Run this in the Supabase SQL Editor
-- =============================================================================

-- 1. Add is_deleted and deleted_at to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Add is_deleted and deleted_at to task_groups
ALTER TABLE public.task_groups ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.task_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Add is_deleted and deleted_at to subtasks
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4. Backfill: mark any previously "[DELETED]"-tagged tasks as soft-deleted
UPDATE public.tasks
SET is_deleted = TRUE,
    deleted_at = NOW()
WHERE title LIKE '[DELETED]%'
  AND is_deleted = FALSE;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
