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
