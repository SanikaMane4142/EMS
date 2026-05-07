-- 1. Ensure a profile exists for the current user
INSERT INTO public.profiles (id, full_name, role)
VALUES (auth.uid(), 'Test User', 'employee')
ON CONFLICT (id) DO NOTHING;

-- 2. Create a test task assigned to the current user
WITH new_task AS (
    INSERT INTO public.tasks (
        title, 
        description, 
        assigned_to, 
        assigned_by, 
        status, 
        priority, 
        due_date
    ) VALUES (
        'Test System Restoration', 
        'Verify that the task management system is working correctly after the schema update.', 
        auth.uid(), 
        auth.uid(), 
        'pending', 
        'high', 
        NOW() + INTERVAL '1 day'
    ) RETURNING id
)
-- 3. Add a task group with a subtask
, new_group AS (
    INSERT INTO public.task_groups (task_id, title, is_completed)
    SELECT id, 'Verification Steps', false FROM new_task
    RETURNING id
)
INSERT INTO public.subtasks (group_id, title, is_completed)
SELECT id, 'Check MyTasks visibility', false FROM new_group;

SELECT 'Test data seeded successfully' as status;

