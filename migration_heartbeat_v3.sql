-- =============================================================================
-- EMS PORTAL — HEARTBEAT MIGRATION (Phase 1)
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to re-run (all statements are idempotent)
-- =============================================================================


-- =============================================================================
-- STEP 1: NEW TABLES
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


-- =============================================================================
-- STEP 2: ADD COLUMNS TO EXISTING TABLES
-- =============================================================================

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


-- =============================================================================
-- STEP 3: ROW LEVEL SECURITY
-- =============================================================================

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


-- =============================================================================
-- STEP 4: UPDATED RPCs
-- =============================================================================

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


-- =============================================================================
-- STEP 5: REFRESH SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload schema';
