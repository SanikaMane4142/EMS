-- =============================================================================
-- EMS PORTAL — MASTER SCHEMA (Single Source of Truth)
-- =============================================================================
-- Run this file on a fresh Supabase project to bootstrap the entire database.
-- It is safe to run on an existing database (all statements are idempotent).
-- Last updated: 2026-05-07
-- =============================================================================


-- =============================================================================
-- SECTION 0: EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- SECTION 1: TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1  DEPARTMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT        NOT NULL UNIQUE,
    icon       TEXT,
    code       TEXT        UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- manager_id references profiles — added after profiles table is created (see below)
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS manager_id UUID;


-- -----------------------------------------------------------------------------
-- 1.2  PROFILES  (linked to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name     TEXT,
    email         TEXT,
    role          TEXT        NOT NULL DEFAULT 'employee'
                              CHECK (role IN ('employee', 'hr', 'admin', 'super_admin')),
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
    department_id UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
    designation   TEXT,
    phone         TEXT,
    avatar_url    TEXT,
    birthday      DATE,
    employee_id   TEXT        UNIQUE,
    joined_at     DATE        DEFAULT CURRENT_DATE,
    joining_date  DATE        DEFAULT CURRENT_DATE,
    is_on_probation BOOLEAN     DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Now that profiles exists, add the FK from departments.manager_id → profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_manager' AND table_name = 'departments'
    ) THEN
        ALTER TABLE public.departments
            ADD CONSTRAINT fk_manager
            FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1.3  ATTENDANCE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attendance_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
    punch_in_time       TIMESTAMPTZ,
    punch_out_time      TIMESTAMPTZ,
    total_hours         DECIMAL(5,2),
    status              TEXT        NOT NULL DEFAULT 'punched_in'
                                    CHECK (status IN ('punched_in', 'punched_out', 'auto_punched_out')),
    -- Lunch break tracking
    lunch_start_time    TIMESTAMPTZ,
    lunch_end_time      TIMESTAMPTZ,
    lunch_duration_ms   BIGINT      DEFAULT 0,
    lunch_delay_reason  TEXT,
    overtime_start_time TIMESTAMPTZ,
    overtime_end_time   TIMESTAMPTZ,
    overtime_duration_ms BIGINT      DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_day UNIQUE (user_id, attendance_date)
);


-- -----------------------------------------------------------------------------
-- 1.4  LEAVE REQUESTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    leave_type            TEXT        NOT NULL,
    start_date            DATE        NOT NULL,
    end_date              DATE        NOT NULL,
    reason                TEXT,
    status                TEXT        NOT NULL DEFAULT 'pending_hr'
                                      CHECK (status IN ('pending_hr', 'pending_super_admin', 'approved', 'rejected')),
    hr_note               TEXT,
    -- Approval tracking
    hr_id                 UUID        REFERENCES public.profiles(id),
    hr_action_at          TIMESTAMPTZ,
    super_admin_id        UUID        REFERENCES public.profiles(id),
    super_admin_action_at TIMESTAMPTZ,
    -- Policy enhancements
    total_days            INTEGER,
    is_lwp                BOOLEAN     DEFAULT FALSE,
    medical_doc_url       TEXT,
    is_sandwich_applied   BOOLEAN     DEFAULT FALSE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 1.5  DAILY REPORTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
    -- Structured content
    tasks_planned       TEXT,
    tasks_completed     TEXT,
    work_in_progress    TEXT,
    tomorrow_plan       TEXT,
    total_working_hours NUMERIC,
    productivity_rating INTEGER,
    additional_notes    TEXT,
    -- Review workflow
    status              TEXT        DEFAULT 'pending',
    reviewed_by         UUID        REFERENCES public.profiles(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT daily_reports_user_id_report_date_key UNIQUE (user_id, report_date)
);


-- -----------------------------------------------------------------------------
-- 1.6  NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    type       TEXT        DEFAULT 'info',  -- 'info' | 'success' | 'warning' | 'error'
    link       TEXT,
    is_read    BOOLEAN     DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
 
-- -----------------------------------------------------------------------------
-- 1.7  LEAVE MANAGEMENT MODULE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_holidays (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    holiday_date DATE       NOT NULL UNIQUE,
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year        INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    cl_total    INTEGER     NOT NULL DEFAULT 20,
    cl_used     INTEGER     NOT NULL DEFAULT 0,
    sl_total    INTEGER     NOT NULL DEFAULT 6,
    sl_used     INTEGER     NOT NULL DEFAULT 0,
    ol_total    INTEGER     NOT NULL DEFAULT 2,
    ol_used     INTEGER     NOT NULL DEFAULT 0,
    cl_carried  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year)
);

CREATE TABLE IF NOT EXISTS public.leave_encashments (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encashment_year INTEGER    NOT NULL,
    days_encashed  INTEGER     NOT NULL,
    processed_at   TIMESTAMPTZ DEFAULT NOW(),
    processed_by   UUID        REFERENCES public.profiles(id),
    status         TEXT        DEFAULT 'pending' CHECK (status IN ('pending', 'processed'))
);


-- -----------------------------------------------------------------------------
-- 1.8  ANNOUNCEMENTS & COMMUNICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    priority    TEXT        DEFAULT 'info' 
                            CHECK (priority IN ('info', 'important', 'urgent', 'emergency')),
    created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active   BOOLEAN     DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================================================
-- SECTION 2: REALTIME
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'leave_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'daily_reports') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'announcements') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;
END $$;


-- =============================================================================
-- SECTION 3: TRIGGERS  (updated_at auto-maintenance)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- leave_requests
DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- daily_reports
DROP TRIGGER IF EXISTS trg_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER trg_daily_reports_updated_at
    BEFORE UPDATE ON public.daily_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- task_groups
DROP TRIGGER IF EXISTS trg_task_groups_updated_at ON public.task_groups;
CREATE TRIGGER trg_task_groups_updated_at
    BEFORE UPDATE ON public.task_groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- subtasks
DROP TRIGGER IF EXISTS trg_subtasks_updated_at ON public.subtasks;
CREATE TRIGGER trg_subtasks_updated_at
    BEFORE UPDATE ON public.subtasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- =============================================================================

-- get_my_role() — reads role from JWT claim (set by custom_access_token_hook)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
    SELECT auth.jwt() ->> 'role';
$$ LANGUAGE sql SECURITY DEFINER;

-- custom_access_token_hook — injects 'role' into every JWT at sign-in
-- NOTE: After running this file you must enable this hook in the Supabase dashboard:
--   Authentication > Hooks > Custom Access Token Hook → select public.custom_access_token_hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claims    jsonb;
    user_role text;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = (event->>'user_id')::uuid;
    IF user_role IS NULL THEN
        user_role := 'employee';
    END IF;

    claims := event->'claims';

    IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
        claims := jsonb_set(claims, '{app_metadata}', '{}');
    END IF;

    claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;


-- admin_create_user — Super Admin creates a new user account
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email         TEXT,
    new_password      TEXT,
    new_full_name     TEXT,
    new_role          TEXT,
    new_department_id UUID    DEFAULT NULL,
    new_employee_id   TEXT    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only Super Admins can create users.';
    END IF;

    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, aud, role,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        new_email,
        crypt(new_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        format('{"full_name":"%s"}', new_full_name)::jsonb,
        'authenticated', 'authenticated',
        now(), now(),
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        format('{"sub":"%s","email":"%s"}', new_user_id, new_email)::jsonb,
        'email', new_email,
        now(), now(), now()
    );

    INSERT INTO public.profiles (id, full_name, email, role, status, department_id, employee_id)
    VALUES (new_user_id, new_full_name, new_email, new_role, 'active', new_department_id, new_employee_id)
    ON CONFLICT (id) DO UPDATE SET
        role          = EXCLUDED.role,
        full_name     = EXCLUDED.full_name,
        department_id = EXCLUDED.department_id,
        employee_id   = EXCLUDED.employee_id,
        status        = 'active';

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user TO service_role;


-- admin_delete_user — Super Admin deletes a user account
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only Super Admins can delete users.';
    END IF;

    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete your own account.';
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;


-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_encashments ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5.1  DEPARTMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_view_all"     ON public.departments;
CREATE POLICY "dept_view_all"     ON public.departments FOR SELECT     TO authenticated USING (true);

DROP POLICY IF EXISTS "dept_manage_admin" ON public.departments;
CREATE POLICY "dept_manage_admin" ON public.departments FOR ALL        TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));


-- -----------------------------------------------------------------------------
-- 5.2  PROFILES
-- -----------------------------------------------------------------------------
-- Drop all legacy/conflicting policy names from old migrations
DROP POLICY IF EXISTS "profiles_self_view"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_view"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_view_all"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_own"           ON public.profiles;
DROP POLICY IF EXISTS "profiles_management_view"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_manage_roles"    ON public.profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_read"          ON public.profiles;

-- Canonical policies
CREATE POLICY "profiles_read_active" ON public.profiles FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY "profiles_self_view"       ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_management_view" ON public.profiles FOR SELECT TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));
CREATE POLICY "profiles_self_update"     ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_hr_update"       ON public.profiles FOR UPDATE TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));
CREATE POLICY "profiles_super_admin_all" ON public.profiles FOR ALL    TO authenticated USING (get_my_role() = 'super_admin');


-- -----------------------------------------------------------------------------
-- 5.3  ATTENDANCE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_self_all" ON public.attendance;
CREATE POLICY "attendance_self_all" ON public.attendance FOR ALL    TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_hr_view" ON public.attendance;
CREATE POLICY "attendance_hr_view"  ON public.attendance FOR SELECT TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "attendance_department_view" ON public.attendance;
CREATE POLICY "attendance_department_view" ON public.attendance FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.department_id = p2.department_id
    WHERE p1.id = attendance.user_id
    AND p2.id = auth.uid()
  )
);


-- -----------------------------------------------------------------------------
-- 5.4  LEAVE REQUESTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "leaves_self_all"    ON public.leave_requests;
DROP POLICY IF EXISTS "employees_view_own" ON public.leave_requests;
DROP POLICY IF EXISTS "employees_create_own" ON public.leave_requests;
DROP POLICY IF EXISTS "admins_manage_all"  ON public.leave_requests;
DROP POLICY IF EXISTS "leaves_hr_manage"   ON public.leave_requests;

CREATE POLICY "leaves_self_all"   ON public.leave_requests FOR ALL    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "leaves_hr_manage"  ON public.leave_requests FOR ALL    TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));


-- -----------------------------------------------------------------------------
-- 5.5  DAILY REPORTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "reports_self_all" ON public.daily_reports;
CREATE POLICY "reports_self_all" ON public.daily_reports FOR ALL    TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_hr_view"   ON public.daily_reports;
CREATE POLICY "reports_hr_view"   ON public.daily_reports FOR SELECT TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "reports_hr_update" ON public.daily_reports;
CREATE POLICY "reports_hr_update" ON public.daily_reports FOR UPDATE TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));


-- -----------------------------------------------------------------------------
-- 5.6  NOTIFICATIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_self_select"          ON public.notifications;
DROP POLICY IF EXISTS "notifications_self_update"          ON public.notifications;
DROP POLICY IF EXISTS "notifications_hr_insert"            ON public.notifications;
DROP POLICY IF EXISTS "notifications_authenticated_insert" ON public.notifications;

CREATE POLICY "notifications_self_select"  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_self_update"  ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- Any authenticated user may send a notification (enables the leave approval workflow)
CREATE POLICY "notifications_any_insert"   ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 5.7  LEAVE MANAGEMENT MODULE
-- -----------------------------------------------------------------------------
-- Balances
CREATE POLICY "balances_view_own" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "balances_admin_all" ON public.leave_balances FOR ALL USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- Holidays
CREATE POLICY "holidays_view_all" ON public.company_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_admin_all" ON public.company_holidays FOR ALL USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- Encashments
CREATE POLICY "encash_view_own" ON public.leave_encashments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "encash_admin_all" ON public.leave_encashments FOR ALL USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- -----------------------------------------------------------------------------
-- 5.8  ANNOUNCEMENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_view_active" ON public.announcements;
CREATE POLICY "announcements_view_active" ON public.announcements FOR SELECT TO authenticated 
    USING (is_active = true);

DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
CREATE POLICY "announcements_admin_all" ON public.announcements FOR ALL TO authenticated 
    USING (get_my_role() IN ('hr', 'admin', 'super_admin'));


-- =============================================================================
-- SECTION 6: TASK MANAGEMENT MODULE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1  TASKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT        NOT NULL,
    description     TEXT,
    project_name    TEXT,
    assigned_to     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_updated_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    department_id   UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
    priority        TEXT        DEFAULT 'Medium'
                                CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status          TEXT        DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'review', 'done', 'cancelled')),
    progress        INTEGER     DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    deadline        DATE,
    is_acknowledged BOOLEAN     DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    needs_changes   BOOLEAN     DEFAULT FALSE,
    changes_completed BOOLEAN   DEFAULT FALSE,
    sort_order      INTEGER     DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6.2  TASK GROUPS  (subtask sections inside a task)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_groups (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID    NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6.3  SUBTASKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subtasks (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID    NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
    title        TEXT    NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    due_date     DATE,
    sort_order   INTEGER DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6.4  TASK ACTIVITY LOGS  (lightweight audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_activity_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID        REFERENCES public.tasks(id) ON DELETE CASCADE,
    actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT        NOT NULL,
    old_value   JSONB,
    new_value   JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6.5  TASK COMMENTS  (Phase 2 — schema ready now)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_comments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    message    TEXT        NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: tasks.updated_at
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for tasks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'subtasks') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
    END IF;
END $$;

-- RLS
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments      ENABLE ROW LEVEL SECURITY;

-- Tasks: employees see tasks they are assigned to OR created
DROP POLICY IF EXISTS "tasks_assignee_view" ON public.tasks;
CREATE POLICY "tasks_assignee_view" ON public.tasks FOR SELECT TO authenticated
    USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

-- Tasks: anyone can create (employee self-task or cross-assignment)
DROP POLICY IF EXISTS "tasks_any_insert" ON public.tasks;
CREATE POLICY "tasks_any_insert" ON public.tasks FOR INSERT TO authenticated
    WITH CHECK (assigned_by = auth.uid());

-- Tasks: assignee updates their own tasks; assigner updates tasks they created
DROP POLICY IF EXISTS "tasks_participant_update" ON public.tasks;
CREATE POLICY "tasks_participant_update" ON public.tasks FOR UPDATE TO authenticated
    USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

-- Tasks: HR/Admin full access
DROP POLICY IF EXISTS "tasks_hr_all" ON public.tasks;
CREATE POLICY "tasks_hr_all" ON public.tasks FOR ALL TO authenticated
    USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- Groups + Subtasks: access if user has access to the parent task
DROP POLICY IF EXISTS "groups_task_access" ON public.task_groups;
CREATE POLICY "groups_task_access" ON public.task_groups FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
             OR get_my_role() IN ('hr','admin','super_admin'))
    ));

DROP POLICY IF EXISTS "subtasks_group_access" ON public.subtasks;
CREATE POLICY "subtasks_group_access" ON public.subtasks FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.task_groups tg
        JOIN public.tasks t ON tg.task_id = t.id
        WHERE tg.id = group_id
        AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
             OR get_my_role() IN ('hr','admin','super_admin'))
    ));

-- Logs: HR can read; any participant can insert
DROP POLICY IF EXISTS "logs_hr_view" ON public.task_activity_logs;
CREATE POLICY "logs_hr_view" ON public.task_activity_logs FOR SELECT TO authenticated
    USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "logs_self_insert" ON public.task_activity_logs;
CREATE POLICY "logs_self_insert" ON public.task_activity_logs FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid());

-- Comments: same access as task
DROP POLICY IF EXISTS "comments_task_access" ON public.task_comments;
CREATE POLICY "comments_task_access" ON public.task_comments FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
             OR get_my_role() IN ('hr','admin','super_admin'))
    ));


-- =============================================================================
-- SECTION 8: TASK MANAGEMENT WORKSPACE (COMMENTS & AUDIT)
-- =============================================================================

-- Table for task-level feedback and discussion
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking status changes and history
CREATE TABLE IF NOT EXISTS task_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'status_changed', 'assigned', 'task_created', etc.
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Comments
CREATE POLICY "Users can view comments for tasks" 
ON task_comments FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" 
ON task_comments FOR INSERT WITH CHECK (auth.uid() = author_id);

-- RLS Policies for Activity Logs
CREATE POLICY "Users can view activity logs" 
ON task_activity_logs FOR SELECT USING (true);

CREATE POLICY "System can insert activity logs" 
ON task_activity_logs FOR INSERT WITH CHECK (true);

-- =============================================================================
-- SECTION 9: SCHEMA CACHE REFRESH
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- SECTION 10: reorder tasks
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

-- 4. Backfill existing [DELETED]-tagged tasks
UPDATE public.tasks
SET is_deleted = TRUE, deleted_at = NOW()
WHERE title LIKE '[DELETED]%' AND is_deleted = FALSE;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- SECTION 11: HEARTBEAT IP VALIDATION MIGRATION (Phase 1)
-- =============================================================================

-- 1A. office_ip_heartbeat — written ONLY by the office server (service_role key)
CREATE TABLE IF NOT EXISTS public.office_ip_heartbeat (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id           TEXT        NOT NULL UNIQUE,      -- e.g. 'main_office'
    office_name         TEXT        NOT NULL,
    current_ip          INET        NOT NULL,
    previous_ip         INET,
    last_heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_changed_at       TIMESTAMPTZ,
    heartbeat_count     BIGINT      DEFAULT 0,
    is_active           BOOLEAN     DEFAULT true,
    server_fingerprint  TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- 1B. ip_change_log — audit trail for every IP change and admin override
CREATE TABLE IF NOT EXISTS public.ip_change_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id       TEXT        NOT NULL,
    old_ip          INET,
    new_ip          INET        NOT NULL,
    changed_at      TIMESTAMPTZ DEFAULT now(),
    change_source   TEXT        NOT NULL,   -- 'heartbeat_auto', 'admin_override', 'fallback'
    metadata        JSONB       DEFAULT '{}'
);

-- 1C. attendance_audit_log — failed punch-in attempts and validation trail
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    attempted_at    TIMESTAMPTZ DEFAULT now(),
    employee_ip     TEXT,
    office_ip       TEXT,
    action          TEXT,       -- 'punch_in', 'punch_out'
    result          TEXT,       -- 'success', 'rejected', 'override'
    reason          TEXT,
    metadata        JSONB       DEFAULT '{}'
);

-- attendance: validation tracking
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS validation_method TEXT;
-- Values: 'heartbeat', 'fallback_allowed_ips', 'admin_override', 'remote_approved'

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS office_ip_at_punch INET;
-- Snapshot of the office IP when the employee punched in

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS ip_address TEXT;
-- Employee's public IP at time of punch

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS validation_status TEXT;
-- 'VALID', 'OVERRIDE', 'PENDING'

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS validation_reason TEXT;
-- Human-readable explanation of the validation result

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE;
-- True if an admin forced this punch-in

-- office_ip_heartbeat: anyone can read, NO one can write (only service_role bypasses RLS)
ALTER TABLE public.office_ip_heartbeat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "heartbeat_read_all" ON public.office_ip_heartbeat;
CREATE POLICY "heartbeat_read_all"
    ON public.office_ip_heartbeat FOR SELECT
    TO authenticated USING (true);
-- NOTE: No INSERT/UPDATE/DELETE policies = only service_role key can write

-- ip_change_log: admins can read
ALTER TABLE public.ip_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ip_change_log_admin_read" ON public.ip_change_log;
CREATE POLICY "ip_change_log_admin_read"
    ON public.ip_change_log FOR SELECT
    TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- attendance_audit_log: admins can read
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_read" ON public.attendance_audit_log;
CREATE POLICY "audit_log_admin_read"
    ON public.attendance_audit_log FOR SELECT
    TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));


-- 4A. check_ip_validity — updated to check heartbeat first, fallback to allowed_ips
CREATE OR REPLACE FUNCTION public.check_ip_validity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee_ip       TEXT;
    v_office_ip         TEXT;
    v_heartbeat_age     INTERVAL;
    v_is_office_network BOOLEAN := false;
    v_source            TEXT := 'none';
BEGIN
    -- Get employee IP from request headers
    v_employee_ip := COALESCE(
        current_setting('request.headers', true)::json->>'x-real-ip',
        split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)
    );
    v_employee_ip := trim(v_employee_ip);

    -- Try heartbeat first
    SELECT current_ip::TEXT, (now() - last_heartbeat_at)
    INTO v_office_ip, v_heartbeat_age
    FROM public.office_ip_heartbeat
    WHERE is_active = true
    ORDER BY last_heartbeat_at DESC
    LIMIT 1;

    IF v_office_ip IS NOT NULL AND v_heartbeat_age <= INTERVAL '15 minutes' THEN
        v_is_office_network := (v_employee_ip::INET = v_office_ip::INET);
        v_source := 'heartbeat';
    ELSE
        -- Fallback to allowed_ips table
        SELECT EXISTS(
            SELECT 1 FROM public.allowed_ips
            WHERE ip_address = v_employee_ip AND is_active = true
        ) INTO v_is_office_network;
        v_source := CASE WHEN v_office_ip IS NOT NULL THEN 'fallback_stale_heartbeat' ELSE 'fallback_allowed_ips' END;
    END IF;

    RETURN jsonb_build_object(
        'ip',               v_employee_ip,
        'office_ip',        v_office_ip,
        'is_office_network', v_is_office_network,
        'validation_source', v_source,
        'heartbeat_age_minutes', EXTRACT(EPOCH FROM v_heartbeat_age) / 60
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ip_validity() TO authenticated;


-- 4B. attendance_punch_in_v3 — validates via heartbeat with fallback
CREATE OR REPLACE FUNCTION public.attendance_punch_in_v3(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee_ip       TEXT;
    v_office_ip         TEXT;
    v_is_valid          BOOLEAN := false;
    v_validation_reason TEXT;
    v_validation_method TEXT;
    v_today             DATE;
    v_result            JSONB;
    v_heartbeat_age     INTERVAL;
BEGIN
    -- 1. Get today's IST date
    v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;

    -- 2. Get employee IP from request headers
    v_employee_ip := COALESCE(
        current_setting('request.headers', true)::json->>'x-real-ip',
        split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)
    );
    v_employee_ip := trim(v_employee_ip);

    -- 3. Try heartbeat validation
    SELECT current_ip::TEXT, (now() - last_heartbeat_at)
    INTO v_office_ip, v_heartbeat_age
    FROM public.office_ip_heartbeat
    WHERE is_active = true
    ORDER BY last_heartbeat_at DESC
    LIMIT 1;

    IF v_office_ip IS NOT NULL AND v_heartbeat_age <= INTERVAL '15 minutes' THEN
        -- Fresh heartbeat available — use it
        v_is_valid := (v_employee_ip::INET = v_office_ip::INET);
        v_validation_method := 'heartbeat';
        v_validation_reason := CASE
            WHEN v_is_valid THEN format('ip_match_heartbeat: %s = office %s', v_employee_ip, v_office_ip)
            ELSE format('REJECTED: employee %s != office %s (heartbeat)', v_employee_ip, v_office_ip)
        END;
    ELSE
        -- Stale/missing heartbeat — fallback to allowed_ips
        SELECT EXISTS(
            SELECT 1 FROM public.allowed_ips
            WHERE ip_address = v_employee_ip AND is_active = true
        ) INTO v_is_valid;
        v_validation_method := 'fallback_allowed_ips';
        v_validation_reason := CASE
            WHEN v_is_valid THEN format('fallback_allowed_ips: %s matched (stale heartbeat)', v_employee_ip)
            ELSE format('REJECTED: %s not in allowed_ips (stale heartbeat)', v_employee_ip)
        END;
    END IF;

    -- 4. Log failed attempt
    IF NOT v_is_valid THEN
        INSERT INTO public.attendance_audit_log (user_id, employee_ip, office_ip, action, result, reason)
        VALUES (p_user_id, v_employee_ip, v_office_ip, 'punch_in', 'rejected', v_validation_reason);

        RAISE EXCEPTION 'IP_RESTRICTED: %', v_validation_reason;
    END IF;

    -- 5. Return existing record if already punched in today
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE user_id = p_user_id AND attendance_date = v_today
    ) THEN
        SELECT row_to_json(a.*)::jsonb INTO v_result
        FROM public.attendance a
        WHERE user_id = p_user_id AND attendance_date = v_today;
        RETURN v_result;
    END IF;

    -- 6. Insert new attendance record
    INSERT INTO public.attendance (
        user_id, attendance_date, punch_in_time, status,
        ip_address, validation_status, validation_reason, validation_method, office_ip_at_punch
    )
    VALUES (
        p_user_id, v_today, now(), 'punched_in',
        v_employee_ip, 'VALID', v_validation_reason, v_validation_method, v_office_ip::INET
    )
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    -- 7. Log success
    INSERT INTO public.attendance_audit_log (user_id, employee_ip, office_ip, action, result, reason)
    VALUES (p_user_id, v_employee_ip, v_office_ip, 'punch_in', 'success', v_validation_reason);

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attendance_punch_in_v3(UUID) TO authenticated;


-- 4C. attendance_punch_out_v3 — validates via heartbeat with fallback
CREATE OR REPLACE FUNCTION public.attendance_punch_out_v3(
    p_record_id         UUID,
    p_lunch_duration_ms BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee_ip       TEXT;
    v_office_ip         TEXT;
    v_is_valid          BOOLEAN := false;
    v_validation_method TEXT;
    v_heartbeat_age     INTERVAL;
    v_record            RECORD;
    v_net_seconds       NUMERIC;
    v_total_hours       NUMERIC;
    v_result            JSONB;
BEGIN
    -- 1. Fetch the attendance record
    SELECT * INTO v_record FROM public.attendance WHERE id = p_record_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Attendance record % not found', p_record_id;
    END IF;

    -- 2. Get employee IP
    v_employee_ip := COALESCE(
        current_setting('request.headers', true)::json->>'x-real-ip',
        split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)
    );
    v_employee_ip := trim(v_employee_ip);

    -- 3. Validate via heartbeat / fallback
    SELECT current_ip::TEXT, (now() - last_heartbeat_at)
    INTO v_office_ip, v_heartbeat_age
    FROM public.office_ip_heartbeat
    WHERE is_active = true
    ORDER BY last_heartbeat_at DESC
    LIMIT 1;

    IF v_office_ip IS NOT NULL AND v_heartbeat_age <= INTERVAL '15 minutes' THEN
        v_is_valid := (v_employee_ip::INET = v_office_ip::INET);
        v_validation_method := 'heartbeat';
    ELSE
        SELECT EXISTS(
            SELECT 1 FROM public.allowed_ips
            WHERE ip_address = v_employee_ip AND is_active = true
        ) INTO v_is_valid;
        v_validation_method := 'fallback_allowed_ips';
    END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'IP_RESTRICTED: Punch-out rejected. Employee IP % not recognized as office network', v_employee_ip;
    END IF;

    -- 4. Calculate total hours (net of lunch)
    v_net_seconds := EXTRACT(EPOCH FROM (now() - v_record.punch_in_time))
                     - COALESCE(p_lunch_duration_ms, 0) / 1000.0;
    v_total_hours := ROUND((v_net_seconds / 3600.0)::NUMERIC, 2);

    -- 5. Update record
    UPDATE public.attendance
    SET
        punch_out_time      = now(),
        total_hours         = LEAST(v_total_hours, 8),   -- Cap regular hours at 8
        status              = 'punched_out',
        lunch_duration_ms   = COALESCE(p_lunch_duration_ms, lunch_duration_ms, 0),
        validation_method   = v_validation_method
    WHERE id = p_record_id
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attendance_punch_out_v3(UUID, BIGINT) TO authenticated;


-- 4D. admin_force_punch_in — emergency override (bypasses IP check)
CREATE OR REPLACE FUNCTION public.admin_force_punch_in(
    p_admin_id      UUID,
    p_target_user_id UUID,
    p_reason        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role TEXT;
    v_today      DATE;
    v_result     JSONB;
BEGIN
    -- Verify caller is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role NOT IN ('hr', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Only admins can force punch-in';
    END IF;

    v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;

    INSERT INTO public.attendance (
        user_id, attendance_date, punch_in_time, status,
        validation_status, validation_reason, is_override, validation_method
    )
    VALUES (
        p_target_user_id, v_today, now(), 'punched_in',
        'OVERRIDE', format('Admin override by %s: %s', p_admin_id, p_reason), true, 'admin_override'
    )
    ON CONFLICT (user_id, attendance_date) DO NOTHING
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    -- Audit log
    INSERT INTO public.ip_change_log (office_id, new_ip, change_source, metadata)
    VALUES ('admin_override', '0.0.0.0', 'admin_override',
        jsonb_build_object('admin_id', p_admin_id, 'target_user', p_target_user_id, 'reason', p_reason));

    RETURN COALESCE(v_result, '{"status": "already_exists"}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_punch_in(UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
-- Add soft delete columns to leave_requests table
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- SECTION 12: AUTHORIZED EARLY PUNCH-OUT
-- =============================================================================

-- 12A. New columns on attendance table for force punch-out tracking
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_force_punched_out BOOLEAN DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS force_punch_out_by UUID REFERENCES profiles(id);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS force_punch_out_reason TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS force_punch_out_note TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS force_punch_out_at TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS approved_full_day BOOLEAN DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS approved_work_hours NUMERIC(4,2);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS actual_work_hours NUMERIC(4,2);

-- 12B. Audit log table for attendance overrides
CREATE TABLE IF NOT EXISTS public.attendance_override_logs (
    id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    attendance_id       UUID        REFERENCES attendance(id),
    employee_id         UUID        REFERENCES profiles(id),
    action_by           UUID        REFERENCES profiles(id),
    action_type         TEXT,
    old_punch_out       TIMESTAMPTZ,
    new_punch_out       TIMESTAMPTZ,
    reason              TEXT,
    note                TEXT,
    approved_full_day   BOOLEAN     DEFAULT FALSE,
    approved_work_hours NUMERIC(4,2),
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- 12C. RLS for attendance_override_logs — HR/Admin/Super Admin only
ALTER TABLE public.attendance_override_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "override_logs_admin_read" ON public.attendance_override_logs;
CREATE POLICY "override_logs_admin_read"
    ON public.attendance_override_logs FOR SELECT
    TO authenticated USING (get_my_role() IN ('hr', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "override_logs_admin_insert" ON public.attendance_override_logs;
CREATE POLICY "override_logs_admin_insert"
    ON public.attendance_override_logs FOR INSERT
    TO authenticated WITH CHECK (get_my_role() IN ('hr', 'admin', 'super_admin'));

-- 12D. RPC: authorized_early_punch_out
CREATE OR REPLACE FUNCTION public.authorized_early_punch_out(
    p_attendance_id UUID,
    p_reason        TEXT,
    p_note          TEXT,
    p_mark_full_day BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role       TEXT;
    v_caller_id         UUID;
    v_record            RECORD;
    v_employee_id       UUID;
    v_punch_out_time    TIMESTAMPTZ;
    v_net_seconds       NUMERIC;
    v_actual_hours      NUMERIC;
    v_approved_hours    NUMERIC;
    v_lunch_ms          BIGINT;
    v_result            JSONB;
BEGIN
    -- 1. Get caller info
    v_caller_id := auth.uid();
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('hr', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Only HR/Admin/Super Admin can perform authorized early punch-out';
    END IF;

    -- 2. Validate reason and note are provided
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'VALIDATION: Reason is required';
    END IF;
    IF p_note IS NULL OR trim(p_note) = '' THEN
        RAISE EXCEPTION 'VALIDATION: Note is required';
    END IF;

    -- 3. Fetch the attendance record
    SELECT * INTO v_record FROM public.attendance WHERE id = p_attendance_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Attendance record not found';
    END IF;

    v_employee_id := v_record.user_id;

    -- 4. Must be currently punched in (punch_out must be null)
    IF v_record.punch_out_time IS NOT NULL THEN
        RAISE EXCEPTION 'INVALID: Employee has already punched out';
    END IF;

    IF v_record.status != 'punched_in' THEN
        RAISE EXCEPTION 'INVALID: Employee is not currently punched in (status: %)', v_record.status;
    END IF;

    -- 5. Cannot apply if already force punched out
    IF v_record.is_force_punched_out = TRUE THEN
        RAISE EXCEPTION 'DUPLICATE: Employee has already been force punched out';
    END IF;

    -- 6. Check if employee is on approved leave today
    IF EXISTS (
        SELECT 1 FROM public.leave_requests
        WHERE user_id = v_employee_id
        AND status = 'approved'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
    ) THEN
        RAISE EXCEPTION 'INVALID: Cannot force punch-out an employee who is on approved leave';
    END IF;

    -- 7. If lunch is currently active, auto-end it
    v_lunch_ms := COALESCE(v_record.lunch_duration_ms, 0);

    IF v_record.lunch_start_time IS NOT NULL AND v_record.lunch_end_time IS NULL THEN
        -- Calculate ongoing lunch duration and add to total
        v_lunch_ms := v_lunch_ms + EXTRACT(EPOCH FROM (now() - v_record.lunch_start_time))::BIGINT * 1000;
    END IF;

    -- 8. Set punch out time
    v_punch_out_time := now();

    -- 9. Calculate actual work hours (punch_in to punch_out minus lunch)
    v_net_seconds := EXTRACT(EPOCH FROM (v_punch_out_time - v_record.punch_in_time))
                     - (v_lunch_ms / 1000.0);
    v_actual_hours := ROUND((v_net_seconds / 3600.0)::NUMERIC, 2);
    IF v_actual_hours < 0 THEN v_actual_hours := 0; END IF;

    -- 10. Determine approved/payable hours
    IF p_mark_full_day THEN
        v_approved_hours := 8.00;
    ELSE
        v_approved_hours := v_actual_hours;
    END IF;

    -- 11. Update the attendance record
    UPDATE public.attendance
    SET
        punch_out_time          = v_punch_out_time,
        total_hours             = LEAST(v_actual_hours, 8),
        status                  = 'punched_out',
        is_force_punched_out    = TRUE,
        force_punch_out_by      = v_caller_id,
        force_punch_out_reason  = p_reason,
        force_punch_out_note    = p_note,
        force_punch_out_at      = v_punch_out_time,
        approved_full_day       = p_mark_full_day,
        approved_work_hours     = v_approved_hours,
        actual_work_hours       = v_actual_hours,
        lunch_duration_ms       = v_lunch_ms,
        -- If lunch was active, close it
        lunch_end_time          = CASE
                                    WHEN v_record.lunch_start_time IS NOT NULL AND v_record.lunch_end_time IS NULL
                                    THEN v_punch_out_time
                                    ELSE v_record.lunch_end_time
                                  END
    WHERE id = p_attendance_id
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    -- 12. Insert audit log
    INSERT INTO public.attendance_override_logs (
        attendance_id, employee_id, action_by, action_type,
        old_punch_out, new_punch_out,
        reason, note, approved_full_day, approved_work_hours
    ) VALUES (
        p_attendance_id, v_employee_id, v_caller_id, 'authorized_early_punch_out',
        NULL, v_punch_out_time,
        p_reason, p_note, p_mark_full_day, v_approved_hours
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authorized_early_punch_out(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ==========================================
-- SECTION 13: EARLY EXIT REQUESTS (EMPLOYEE INITIATED)
-- ==========================================

-- 13A. Create Table
CREATE TABLE public.early_exit_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewer_note TEXT,
    approved_full_day BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_early_exit_requests_attendance_id ON public.early_exit_requests(attendance_id);
CREATE INDEX idx_early_exit_requests_employee_id ON public.early_exit_requests(employee_id);
CREATE INDEX idx_early_exit_requests_status ON public.early_exit_requests(status);

-- 13B. Trigger for updated_at
CREATE TRIGGER update_early_exit_requests_updated_at
    BEFORE UPDATE ON public.early_exit_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 13C. RLS Policies
ALTER TABLE public.early_exit_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own requests
CREATE POLICY "Users can view their own early exit requests" 
    ON public.early_exit_requests FOR SELECT 
    USING (auth.uid() = employee_id);

-- HR/Admin/Super Admin can view all requests
CREATE POLICY "Admins can view all early exit requests" 
    ON public.early_exit_requests FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
        )
    );

-- Employees can insert their own requests
CREATE POLICY "Users can insert their own early exit requests" 
    ON public.early_exit_requests FOR INSERT 
    WITH CHECK (auth.uid() = employee_id);

-- HR/Admin/Super Admin can update requests
CREATE POLICY "Admins can update early exit requests" 
    ON public.early_exit_requests FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
        )
    );

-- 13D. RPC for reviewing requests (HR side)
CREATE OR REPLACE FUNCTION public.review_early_exit_request(
    p_request_id UUID,
    p_status TEXT,
    p_reviewer_note TEXT,
    p_mark_full_day BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_request RECORD;
BEGIN
    -- 1. Validate caller role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('hr', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only HR/Admin can review early exit requests.';
    END IF;

    -- 2. Validate status input
    IF p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status. Must be approved or rejected.';
    END IF;

    -- 3. Get request details
    SELECT * INTO v_request FROM public.early_exit_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Early exit request not found.';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'This request has already been processed.';
    END IF;

    -- 4. Update the request status (We no longer punch out automatically)
    UPDATE public.early_exit_requests
    SET 
        status = p_status,
        reviewer_id = v_caller_id,
        reviewer_note = p_reviewer_note,
        approved_full_day = p_mark_full_day,
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', p_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_early_exit_request(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 13E. RPC for manual punch out after approval (Employee side)
CREATE OR REPLACE FUNCTION public.employee_approved_early_punch_out(
    p_attendance_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee_id UUID := auth.uid();
    v_record RECORD;
    v_request RECORD;
    v_punch_out_time TIMESTAMPTZ;
    v_actual_hours NUMERIC;
    v_approved_hours NUMERIC;
    v_net_seconds NUMERIC;
    v_lunch_ms BIGINT;
    v_result JSONB;
BEGIN
    -- 1. Validate the attendance record
    SELECT * INTO v_record FROM public.attendance WHERE id = p_attendance_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record not found.';
    END IF;

    -- 2. Ensure it belongs to the caller
    IF v_record.user_id != v_employee_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only punch out your own attendance record.';
    END IF;

    -- 3. Ensure they are currently punched in
    IF v_record.punch_out_time IS NOT NULL THEN
        RAISE EXCEPTION 'Employee is already punched out.';
    END IF;

    -- 4. Check for an approved early exit request
    SELECT * INTO v_request FROM public.early_exit_requests 
    WHERE attendance_id = p_attendance_id AND status = 'approved'
    ORDER BY created_at DESC LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No approved early exit request found for this shift.';
    END IF;

    -- 5. If lunch is currently active, auto-end it
    v_lunch_ms := COALESCE(v_record.lunch_duration_ms, 0);

    IF v_record.lunch_start_time IS NOT NULL AND v_record.lunch_end_time IS NULL THEN
        -- Calculate ongoing lunch duration and add to total
        v_lunch_ms := v_lunch_ms + EXTRACT(EPOCH FROM (now() - v_record.lunch_start_time))::BIGINT * 1000;
    END IF;

    -- 6. Set punch out time
    v_punch_out_time := now();

    -- 7. Calculate actual work hours
    v_net_seconds := EXTRACT(EPOCH FROM (v_punch_out_time - v_record.punch_in_time))
                     - (v_lunch_ms / 1000.0);
    v_actual_hours := ROUND((v_net_seconds / 3600.0)::NUMERIC, 2);
    IF v_actual_hours < 0 THEN v_actual_hours := 0; END IF;

    -- 8. Determine approved/payable hours
    IF COALESCE(v_request.approved_full_day, FALSE) THEN
        v_approved_hours := 8.00;
    ELSE
        v_approved_hours := v_actual_hours;
    END IF;

    -- 9. Update the attendance record
    UPDATE public.attendance
    SET
        punch_out_time          = v_punch_out_time,
        total_hours             = LEAST(v_actual_hours, 8),
        status                  = 'punched_out',
        is_force_punched_out    = TRUE,
        force_punch_out_by      = v_request.reviewer_id, -- HR who approved it
        force_punch_out_reason  = v_request.reason,
        force_punch_out_note    = v_request.note || ' (Employee manually punched out)',
        force_punch_out_at      = v_punch_out_time,
        approved_full_day       = COALESCE(v_request.approved_full_day, FALSE),
        approved_work_hours     = v_approved_hours,
        actual_work_hours       = v_actual_hours,
        lunch_duration_ms       = v_lunch_ms,
        lunch_end_time          = CASE
                                    WHEN v_record.lunch_start_time IS NOT NULL AND v_record.lunch_end_time IS NULL
                                    THEN v_punch_out_time
                                    ELSE v_record.lunch_end_time
                                  END
    WHERE id = p_attendance_id
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    -- 10. Insert audit log
    INSERT INTO public.attendance_override_logs (
        attendance_id, employee_id, action_by, action_type,
        old_punch_out, new_punch_out,
        reason, note, approved_full_day, approved_work_hours
    ) VALUES (
        p_attendance_id, v_employee_id, v_employee_id, 'employee_approved_early_punch_out',
        NULL, v_punch_out_time,
        v_request.reason, v_request.note, COALESCE(v_request.approved_full_day, FALSE), v_approved_hours
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_approved_early_punch_out(UUID) TO authenticated;

-- =============================================================================
-- EMS PORTAL — DELAYED MEDICAL CERTIFICATE UPLOAD MIGRATION
-- =============================================================================
-- This section applies database changes for the medical certificate grace period,
-- verification workflow, and auto-conversion system.
-- =============================================================================

-- 1. Create custom enum type for medical document status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medical_document_status') THEN
        CREATE TYPE medical_document_status AS ENUM (
            'medical_doc_pending',      -- Document is missing, waiting for upload
            'medical_doc_submitted',    -- Document uploaded, awaiting HR review
            'medical_doc_verified',     -- Verified and approved by HR
            'medical_doc_rejected',     -- Uploaded but rejected by HR
            'medical_doc_expired'       -- Deadline passed, document not uploaded or verified
        );
    END IF;
END $$;

-- 2. Add columns to leave_requests
ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS medical_doc_status medical_document_status DEFAULT NULL,
ADD COLUMN IF NOT EXISTS medical_doc_deadline TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_leave_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conversion_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Create public.leave_action_logs (Audit Trails)
CREATE TABLE IF NOT EXISTS public.leave_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Null if automated system cron
    action_type TEXT NOT NULL, -- 'document_upload', 'document_verify', 'document_reject', 'auto_convert', 'admin_override'
    previous_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and setup policies
ALTER TABLE public.leave_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_logs_view_all_admin" ON public.leave_action_logs;
CREATE POLICY "action_logs_view_all_admin" ON public.leave_action_logs FOR SELECT TO authenticated
    USING (public.get_my_role() IN ('hr', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "action_logs_view_own" ON public.leave_action_logs;
CREATE POLICY "action_logs_view_own" ON public.leave_action_logs FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.leave_requests lr 
        WHERE lr.id = leave_request_id AND lr.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "action_logs_insert" ON public.leave_action_logs;
CREATE POLICY "action_logs_insert" ON public.leave_action_logs FOR INSERT TO authenticated
    WITH CHECK (true);

-- 4. Create public.leave_reminders_log (Notification Deduplication)
CREATE TABLE IF NOT EXISTS public.leave_reminders_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    reminder_interval INTEGER NOT NULL, -- 10, 18, 19 (days before expiry)
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    channel TEXT NOT NULL -- 'in_app', 'email'
);

-- Unique index to prevent duplicate notifications for the same interval
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_request_reminder 
ON public.leave_reminders_log(leave_request_id, reminder_interval);

ALTER TABLE public.leave_reminders_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_log_view_all_admin" ON public.leave_reminders_log;
CREATE POLICY "reminders_log_view_all_admin" ON public.leave_reminders_log FOR SELECT TO authenticated
    USING (public.get_my_role() IN ('hr', 'admin', 'super_admin'));

-- 5. Trigger: Automating Deadlines & Initial Status
CREATE OR REPLACE FUNCTION public.trg_initialize_medical_certificate_requirements()
RETURNS TRIGGER AS $$
BEGIN
    -- Detect Sick/Medical Leave and duration >= 2 days
    IF NEW.leave_type IN ('sick_leave', 'Sick Leave', 'Medical/Sick Leave (ML/SL)') AND NEW.total_days >= 2 THEN
        -- Establish deadline (leave end date + 20 days)
        IF NEW.medical_doc_deadline IS NULL THEN
            NEW.medical_doc_deadline := (NEW.end_date + INTERVAL '20 days')::TIMESTAMPTZ;
        END IF;
        
        -- Establish initial status
        IF NEW.medical_doc_status IS NULL THEN
            IF NEW.medical_doc_url IS NOT NULL AND NEW.medical_doc_url <> '' THEN
                NEW.medical_doc_status := 'medical_doc_submitted'::public.medical_document_status;
            ELSE
                NEW.medical_doc_status := 'medical_doc_pending'::public.medical_document_status;
            END IF;
        -- If status was pending, and we just got an upload url, mark as submitted
        ELSIF NEW.medical_doc_status = 'medical_doc_pending'::public.medical_document_status AND NEW.medical_doc_url IS NOT NULL AND NEW.medical_doc_url <> '' THEN
            NEW.medical_doc_status := 'medical_doc_submitted'::public.medical_document_status;
        END IF;
    ELSE
        -- Clear fields for non-medical or short-term medical leaves
        NEW.medical_doc_deadline := NULL;
        NEW.medical_doc_status := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pre_save_leave_medical_req ON public.leave_requests;
CREATE TRIGGER trg_pre_save_leave_medical_req
    BEFORE INSERT OR UPDATE OF leave_type, end_date, total_days, medical_doc_url, medical_doc_status
    ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_initialize_medical_certificate_requirements();

-- 7. Update leave_requests RLS policy to allow upload updates before deadline
DROP POLICY IF EXISTS "leaves_self_update_medical_doc" ON public.leave_requests;
CREATE POLICY "leaves_self_update_medical_doc"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id 
    AND (medical_doc_status IS NULL OR medical_doc_status IN ('medical_doc_pending'::public.medical_document_status, 'medical_doc_rejected'::public.medical_document_status))
    AND (medical_doc_deadline IS NULL OR NOW() <= medical_doc_deadline)
)
WITH CHECK (
    auth.uid() = user_id
    AND (
        medical_doc_status IS NULL
        OR medical_doc_status IN (
            'medical_doc_pending'::public.medical_document_status,
            'medical_doc_rejected'::public.medical_document_status,
            'medical_doc_submitted'::public.medical_document_status
        )
    )
);

-- =============================================================================
-- 8. RPC FUNCTIONS
-- =============================================================================

-- RPC: verify_medical_document
CREATE OR REPLACE FUNCTION public.verify_medical_document(
    p_leave_id UUID,
    p_status TEXT, -- 'verified' or 'rejected'
    p_reason TEXT DEFAULT NULL,
    p_grant_extension BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_id UUID;
    v_record RECORD;
    v_new_deadline TIMESTAMPTZ;
BEGIN
    v_caller_id := auth.uid();
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('hr', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Only HR/Admin/Super Admin can verify medical documents';
    END IF;

    SELECT * INTO v_record FROM public.leave_requests WHERE id = p_leave_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Leave request % not found', p_leave_id;
    END IF;

    IF v_record.medical_doc_status IS NULL THEN
        RAISE EXCEPTION 'INVALID: This leave request does not require a medical certificate';
    END IF;

    IF p_status = 'verified' THEN
        UPDATE public.leave_requests
        SET medical_doc_status = 'medical_doc_verified'::public.medical_document_status,
            verification_metadata = jsonb_build_object(
                'verified_by', v_caller_id,
                'verified_at', NOW()
            ),
            updated_at = NOW()
        WHERE id = p_leave_id;

        -- Log audit trail
        INSERT INTO public.leave_action_logs (leave_request_id, actor_id, action_type, previous_state, new_state)
        VALUES (p_leave_id, v_caller_id, 'document_verify', 
                jsonb_build_object('status', v_record.medical_doc_status),
                jsonb_build_object('status', 'medical_doc_verified'));

        -- Notify Employee
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            v_record.user_id,
            'Medical Certificate Verified',
            'Your uploaded medical certificate has been verified and approved.',
            'success',
            '/my-leaves'
        );

    ELSIF p_status = 'rejected' THEN
        IF p_reason IS NULL OR trim(p_reason) = '' THEN
            RAISE EXCEPTION 'VALIDATION: Rejection reason is required';
        END IF;

        v_new_deadline := v_record.medical_doc_deadline;
        IF p_grant_extension THEN
            v_new_deadline := NOW() + INTERVAL '5 days';
        END IF;

        UPDATE public.leave_requests
        SET medical_doc_status = 'medical_doc_rejected'::public.medical_document_status,
            medical_doc_deadline = v_new_deadline,
            verification_metadata = jsonb_build_object(
                'rejected_by', v_caller_id,
                'rejected_at', NOW(),
                'rejection_reason', p_reason,
                'extension_granted', p_grant_extension
            ),
            updated_at = NOW()
        WHERE id = p_leave_id;

        -- Log audit trail
        INSERT INTO public.leave_action_logs (leave_request_id, actor_id, action_type, previous_state, new_state, reason)
        VALUES (p_leave_id, v_caller_id, 'document_reject', 
                jsonb_build_object('status', v_record.medical_doc_status),
                jsonb_build_object('status', 'medical_doc_rejected', 'deadline', v_new_deadline),
                p_reason);

        -- Notify Employee
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            v_record.user_id,
            'Medical Certificate Rejected',
            format('Your medical certificate was rejected: %s. Please re-upload before %s.', p_reason, (v_new_deadline AT TIME ZONE 'Asia/Kolkata')::date),
            'error',
            '/my-leaves'
        );
    ELSE
        RAISE EXCEPTION 'INVALID: Invalid verification status. Use ''verified'' or ''rejected''';
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_medical_document(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- RPC: admin_override_conversion
CREATE OR REPLACE FUNCTION public.admin_override_conversion(
    p_leave_id UUID,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_id UUID;
    v_record RECORD;
    v_balance RECORD;
    v_current_year INTEGER;
    v_cl_deducted INTEGER;
BEGIN
    v_caller_id := auth.uid();
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('hr', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Only HR/Admin/Super Admin can override conversions';
    END IF;

    IF p_note IS NULL OR trim(p_note) = '' THEN
        RAISE EXCEPTION 'VALIDATION: Override reason note is required';
    END IF;

    SELECT * INTO v_record FROM public.leave_requests WHERE id = p_leave_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Leave request % not found', p_leave_id;
    END IF;

    IF NOT v_record.is_converted THEN
        RAISE EXCEPTION 'INVALID: This leave request has not been automatically converted';
    END IF;

    v_current_year := EXTRACT(YEAR FROM v_record.start_date)::INTEGER;
    v_cl_deducted := COALESCE((v_record.conversion_metadata->>'cl_deducted')::INTEGER, 0);

    -- 1. Refund Casual Leave if it was deducted
    IF v_cl_deducted > 0 THEN
        UPDATE public.leave_balances
        SET cl_used = cl_used - v_cl_deducted,
            updated_at = NOW()
        WHERE user_id = v_record.user_id AND year = v_current_year;
    END IF;

    -- 2. Restore leave type and flags
    UPDATE public.leave_requests
    SET leave_type = COALESCE(original_leave_type, 'sick_leave'),
        is_lwp = FALSE,
        is_converted = FALSE,
        medical_doc_status = 'medical_doc_verified'::public.medical_document_status,
        conversion_metadata = v_record.conversion_metadata || jsonb_build_object(
            'overridden_by', v_caller_id,
            'overridden_at', NOW(),
            'override_reason', p_note
        ),
        updated_at = NOW()
    WHERE id = p_leave_id;

    -- 3. Log to audit trail
    INSERT INTO public.leave_action_logs (leave_request_id, actor_id, action_type, previous_state, new_state, reason)
    VALUES (p_leave_id, v_caller_id, 'admin_override',
            jsonb_build_object('leave_type', v_record.leave_type, 'is_converted', true),
            jsonb_build_object('leave_type', COALESCE(v_record.original_leave_type, 'sick_leave'), 'is_converted', false, 'medical_doc_status', 'medical_doc_verified'),
            p_note);

    -- 4. Notify Employee
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
        v_record.user_id,
        'Leave Conversion Reverted',
        'HR has approved your late medical certificate upload and restored your leave type.',
        'success',
        '/my-leaves'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_override_conversion(UUID, TEXT) TO authenticated;

-- =============================================================================
-- 9. AUTOMATION / BACKGROUND JOBS (CRONS)
-- =============================================================================

-- Cron Job 1: Reminder Dispatcher
CREATE OR REPLACE FUNCTION public.cron_dispatch_medical_document_reminders()
RETURNS void AS $$
DECLARE
    v_rec RECORD;
    v_message TEXT;
    v_interval_tag INTEGER;
BEGIN
    FOR v_rec IN 
        SELECT 
            lr.id, lr.user_id, lr.start_date, lr.end_date, lr.medical_doc_deadline, p.full_name, p.email,
            (EXTRACT(EPOCH FROM (lr.medical_doc_deadline - NOW())) / 86400.0) AS days_remaining
        FROM public.leave_requests lr
        JOIN public.profiles p ON lr.user_id = p.id
        WHERE lr.medical_doc_status = 'medical_doc_pending'::public.medical_document_status
          AND lr.status = 'approved'
          AND lr.is_deleted = FALSE
          AND lr.medical_doc_deadline > NOW()
    LOOP
        -- Determine reminder interval
        IF v_rec.days_remaining BETWEEN 9.0 AND 10.1 THEN
            v_interval_tag := 10;
        ELSIF v_rec.days_remaining BETWEEN 1.8 AND 2.2 THEN
            v_interval_tag := 18; -- 2 days left
        ELSIF v_rec.days_remaining BETWEEN 0.8 AND 1.2 THEN
            v_interval_tag := 19; -- 1 day left (final reminder)
        ELSE
            CONTINUE;
        END IF;

        -- Attempt to log sending to prevent duplicate dispatch
        BEGIN
            INSERT INTO public.leave_reminders_log (leave_request_id, reminder_interval, channel)
            VALUES (v_rec.id, v_interval_tag, 'in_app');
        EXCEPTION WHEN unique_violation THEN
            -- Reminder already sent, skip
            CONTINUE;
        END;

        v_message := format(
            'Reminder: Please upload your medical certificate for leave from %s to %s. Deadline is %s.',
            v_rec.start_date, v_rec.end_date, (v_rec.medical_doc_deadline AT TIME ZONE 'Asia/Kolkata')::date
        );

        -- Insert into system notifications table
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            v_rec.user_id,
            'Medical Certificate Required',
            v_message,
            'warning',
            '/my-leaves'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron Job 2: Auto-Leave Converter
CREATE OR REPLACE FUNCTION public.cron_auto_convert_expired_medical_leaves()
RETURNS void AS $$
DECLARE
    v_rec RECORD;
    v_balance RECORD;
    v_current_year INTEGER;
    v_cl_available INTEGER;
    v_cl_to_deduct INTEGER;
    v_lwp_days INTEGER;
BEGIN
    FOR v_rec IN 
        SELECT id, user_id, total_days, start_date, end_date, leave_type
        FROM public.leave_requests
        WHERE medical_doc_status IN ('medical_doc_pending'::public.medical_document_status, 'medical_doc_rejected'::public.medical_document_status)
          AND medical_doc_deadline <= NOW()
          AND status = 'approved'
          AND is_converted = FALSE
          AND is_deleted = FALSE
    LOOP
        v_current_year := EXTRACT(YEAR FROM v_rec.start_date)::INTEGER;
        
        -- Fetch user's leave balances
        SELECT * INTO v_balance 
        FROM public.leave_balances 
        WHERE user_id = v_rec.user_id AND year = v_current_year;

        IF NOT FOUND THEN
            v_cl_available := 0;
        ELSE
            v_cl_available := (v_balance.cl_total + v_balance.cl_carried) - v_balance.cl_used;
        END IF;

        IF v_cl_available < 0 THEN v_cl_available := 0; END IF;

        IF v_cl_available >= v_rec.total_days THEN
            -- Scenario A: Complete conversion to Casual Leave
            -- 1. Deduct CL Balance
            UPDATE public.leave_balances
            SET cl_used = cl_used + v_rec.total_days,
                updated_at = NOW()
            WHERE user_id = v_rec.user_id AND year = v_current_year;

            -- 2. Adjust Leave Request status & type
            UPDATE public.leave_requests
            SET leave_type = 'casual_leave',
                original_leave_type = v_rec.leave_type,
                is_converted = TRUE,
                medical_doc_status = 'medical_doc_expired'::public.medical_document_status,
                conversion_metadata = jsonb_build_object(
                    'converted_at', NOW(),
                    'type', 'casual_leave',
                    'cl_deducted', v_rec.total_days,
                    'lwp_days', 0
                ),
                updated_at = NOW()
            WHERE id = v_rec.id;
            
        ELSE
            -- Scenario B: Insufficient CL. Convert what is available to CL, rest to LWP.
            v_cl_to_deduct := v_cl_available;
            v_lwp_days := v_rec.total_days - v_cl_to_deduct;

            -- 1. Deduct all remaining CL
            IF v_cl_to_deduct > 0 THEN
                UPDATE public.leave_balances
                SET cl_used = cl_used + v_cl_to_deduct,
                    updated_at = NOW()
                WHERE user_id = v_rec.user_id AND year = v_current_year;
            END IF;

            -- 2. Adjust Leave Request
            UPDATE public.leave_requests
            SET leave_type = 'lwp',
                is_lwp = TRUE,
                original_leave_type = v_rec.leave_type,
                is_converted = TRUE,
                medical_doc_status = 'medical_doc_expired'::public.medical_document_status,
                conversion_metadata = jsonb_build_object(
                    'converted_at', NOW(),
                    'type', 'lwp',
                    'cl_deducted', v_cl_to_deduct,
                    'lwp_days', v_lwp_days
                ),
                updated_at = NOW()
            WHERE id = v_rec.id;
        END IF;

        -- 3. Log to action logs
        INSERT INTO public.leave_action_logs (leave_request_id, actor_id, action_type, previous_state, new_state, reason)
        VALUES (
            v_rec.id,
            NULL,
            'auto_convert',
            jsonb_build_object('leave_type', v_rec.leave_type, 'is_lwp', FALSE),
            jsonb_build_object('medical_doc_status', 'medical_doc_expired', 'is_converted', TRUE),
            'Automated conversion: medical certificate deadline elapsed.'
        );

        -- 4. Notify employee
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            v_rec.user_id,
            'Leave Converted Automatically',
            format('Your sick leave from %s has been converted due to missing medical proof.', v_rec.start_date),
            'error',
            '/my-leaves'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13E. Refresh schema cache
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- EMS PORTAL — ATTENDANCE + LEAVE + ABSENCE EXPLANATION WORKFLOW
-- =============================================================================
-- This section normalizes non-punched day states and creates the absence
-- explanation workflow with corrected future-date handling.
-- =============================================================================

-- 0. Normalize legacy attendance nullability for non-punched day states
ALTER TABLE public.attendance
  ALTER COLUMN punch_in_time DROP NOT NULL,
  ALTER COLUMN punch_out_time DROP NOT NULL,
  ALTER COLUMN total_hours DROP NOT NULL;

-- 1. Expand attendance statuses
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (
    status IN (
      'punched_in',
      'punched_out',
      'auto_punched_out',
      'on_leave',
      'absent_unjustified',
      'absent_explanation_pending',
      'absent_explained'
    )
  );

-- 2. Absent explanation workflow table
CREATE TABLE IF NOT EXISTS public.attendance_explanations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  reviewed_by   UUID REFERENCES public.profiles(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_explanations_one_per_day UNIQUE (attendance_id)
);

-- update trigger for updated_at
DROP TRIGGER IF EXISTS trg_attendance_explanations_updated_at ON public.attendance_explanations;
CREATE TRIGGER trg_attendance_explanations_updated_at
  BEFORE UPDATE ON public.attendance_explanations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS + policies for attendance_explanations
ALTER TABLE public.attendance_explanations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_explanations_self_select" ON public.attendance_explanations;
CREATE POLICY "attendance_explanations_self_select"
ON public.attendance_explanations FOR SELECT TO authenticated
USING (auth.uid() = user_id OR get_my_role() IN ('hr','admin','super_admin'));

DROP POLICY IF EXISTS "attendance_explanations_self_insert" ON public.attendance_explanations;
CREATE POLICY "attendance_explanations_self_insert"
ON public.attendance_explanations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_explanations_self_update" ON public.attendance_explanations;
CREATE POLICY "attendance_explanations_self_update"
ON public.attendance_explanations FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_explanations_hr_manage" ON public.attendance_explanations;
CREATE POLICY "attendance_explanations_hr_manage"
ON public.attendance_explanations FOR ALL TO authenticated
USING (get_my_role() IN ('hr','admin','super_admin'));

-- 4. Deterministic status resolver per user/day
CREATE OR REPLACE FUNCTION public.recompute_attendance_status(
  p_user_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att public.attendance%ROWTYPE;
  v_has_approved_leave BOOLEAN := FALSE;
  v_exp_status TEXT := NULL;
  v_new_status TEXT;
  v_today DATE := public.get_today_ist();
BEGIN
  -- If the target date is in the future, do not mark as absent.
  IF p_date > v_today THEN
    -- Check if there is an approved leave for this future date
    SELECT EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.user_id = p_user_id
        AND lr.status = 'approved'
        AND p_date BETWEEN lr.start_date AND lr.end_date
    ) INTO v_has_approved_leave;

    IF v_has_approved_leave THEN
      -- Ensure daily attendance row exists and set to on_leave
      INSERT INTO public.attendance (user_id, attendance_date, status)
      VALUES (p_user_id, p_date, 'on_leave')
      ON CONFLICT (user_id, attendance_date)
      DO UPDATE SET status = 'on_leave';
    ELSE
      -- Clean up any existing placeholder rows for this future date (where no punch exists)
      DELETE FROM public.attendance
      WHERE user_id = p_user_id 
        AND attendance_date = p_date 
        AND punch_in_time IS NULL;
    END IF;
    RETURN;
  END IF;

  -- Ensure daily attendance row exists for today or past dates
  INSERT INTO public.attendance (user_id, attendance_date, status)
  VALUES (p_user_id, p_date, 'absent_unjustified')
  ON CONFLICT (user_id, attendance_date) DO NOTHING;

  SELECT * INTO v_att
  FROM public.attendance
  WHERE user_id = p_user_id
    AND attendance_date = p_date
  FOR UPDATE;

  -- Highest precedence: any punch activity means present path
  IF v_att.punch_in_time IS NOT NULL THEN
    IF v_att.punch_out_time IS NULL THEN
      v_new_status := 'punched_in';
    ELSE
      IF COALESCE(v_att.total_hours, 0) > 8 THEN
        v_new_status := 'auto_punched_out';
      ELSE
        v_new_status := 'punched_out';
      END IF;
    END IF;

    UPDATE public.attendance
    SET status = v_new_status
    WHERE id = v_att.id;
    RETURN;
  END IF;

  -- Approved leave check
  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = p_user_id
      AND lr.status = 'approved'
      AND p_date BETWEEN lr.start_date AND lr.end_date
  ) INTO v_has_approved_leave;

  IF v_has_approved_leave THEN
    UPDATE public.attendance
    SET status = 'on_leave'
    WHERE id = v_att.id;
    RETURN;
  END IF;

  -- Absence explanation state
  SELECT ae.status
  INTO v_exp_status
  FROM public.attendance_explanations ae
  WHERE ae.attendance_id = v_att.id
  LIMIT 1;

  IF v_exp_status = 'approved' THEN
    v_new_status := 'absent_explained';
  ELSIF v_exp_status = 'pending' THEN
    v_new_status := 'absent_explanation_pending';
  ELSE
    v_new_status := 'absent_unjustified';
  END IF;

  UPDATE public.attendance
  SET status = v_new_status
  WHERE id = v_att.id;
END;
$$;

-- 5. Range sync for leave changes (handles day-2 approvals / retroactive updates)
CREATE OR REPLACE FUNCTION public.sync_attendance_for_leave_request(
  p_leave_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
  v_d DATE;
BEGIN
  SELECT * INTO v_leave
  FROM public.leave_requests
  WHERE id = p_leave_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_d := v_leave.start_date;
  WHILE v_d <= v_leave.end_date LOOP
    PERFORM public.recompute_attendance_status(v_leave.user_id, v_d);
    v_d := v_d + INTERVAL '1 day';
  END LOOP;
END;
$$;

-- 6. Trigger to auto-sync attendance when leave status/date range changes
CREATE OR REPLACE FUNCTION public.trg_leave_request_attendance_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.sync_attendance_for_leave_request(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.start_date IS DISTINCT FROM OLD.start_date
      OR NEW.end_date IS DISTINCT FROM OLD.end_date
    ) THEN
      -- recompute old range
      IF OLD.start_date IS NOT NULL AND OLD.end_date IS NOT NULL THEN
        PERFORM public.sync_attendance_for_leave_request(OLD.id);
      END IF;
      -- recompute new range
      PERFORM public.sync_attendance_for_leave_request(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_attendance_sync ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_attendance_sync
AFTER INSERT OR UPDATE OF status, start_date, end_date
ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_leave_request_attendance_sync();

-- 7. Trigger to sync attendance when explanation is inserted/updated
CREATE OR REPLACE FUNCTION public.trg_attendance_explanations_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att RECORD;
BEGIN
  SELECT * INTO v_att FROM public.attendance WHERE id = NEW.attendance_id;
  IF FOUND THEN
    PERFORM public.recompute_attendance_status(v_att.user_id, v_att.attendance_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_explanations_sync ON public.attendance_explanations;
CREATE TRIGGER trg_attendance_explanations_sync
AFTER INSERT OR UPDATE OF status, reason, reviewer_note
ON public.attendance_explanations
FOR EACH ROW
EXECUTE FUNCTION public.trg_attendance_explanations_sync();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.attendance_explanations TO authenticated;

-- Clean up any incorrect future absent placeholders immediately
DELETE FROM public.attendance
WHERE attendance_date > public.get_today_ist()
  AND punch_in_time IS NULL;

-- Final reload
NOTIFY pgrst, 'reload schema';

