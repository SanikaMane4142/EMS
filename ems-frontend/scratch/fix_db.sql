-- =============================================================================
-- FIX: ADD MISSING COLUMN TO TASK_GROUPS
-- =============================================================================

-- 1. Add is_completed column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task_groups' AND column_name = 'is_completed'
    ) THEN
        ALTER TABLE public.task_groups ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Verify RLS for tasks (ensure visibility for both assigner and assignee)
DROP POLICY IF EXISTS "tasks_assignee_view" ON public.tasks;
CREATE POLICY "tasks_assignee_view" ON public.tasks FOR SELECT TO authenticated
    USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

-- 3. Verify RLS for groups and subtasks
DROP POLICY IF EXISTS "groups_task_access" ON public.task_groups;
CREATE POLICY "groups_task_access" ON public.task_groups FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
             OR get_my_role() IN ('hr','admin','super_admin'))
    ));

-- 4. Ensure profiles are readable by all authenticated users (needed for task lookup)
DROP POLICY IF EXISTS "profiles_view_all" ON public.profiles;
CREATE POLICY "profiles_view_all" ON public.profiles FOR SELECT TO authenticated USING (true);

-- 5. Sync schema cache
NOTIFY pgrst, 'reload schema';
