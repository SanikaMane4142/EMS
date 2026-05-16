-- =============================================================================
-- MIGRATION: Secure IP-Based Attendance Validation (Safe/Non-Destructive)
-- Date: 2026-05-16
-- =============================================================================

BEGIN;

-- 1) Create allowed_ips table
CREATE TABLE IF NOT EXISTS public.allowed_ips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_name TEXT NOT NULL,
    ip_address  TEXT NOT NULL UNIQUE,
    ip_range    TEXT, -- Placeholder for future CIDR support
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.allowed_ips ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view IPs (needed for context validation)
DROP POLICY IF EXISTS "View allowed IPs" ON public.allowed_ips;
CREATE POLICY "View allowed IPs" ON public.allowed_ips 
FOR SELECT TO authenticated USING (TRUE);

-- Policy: Only HR/Admin can manage IPs
DROP POLICY IF EXISTS "Manage allowed IPs" ON public.allowed_ips;
CREATE POLICY "Manage allowed IPs" ON public.allowed_ips 
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('hr', 'admin', 'super_admin')
    )
);


-- 2) Add audit columns to attendance table (Safe Alterations)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS validation_status TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS validation_reason TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- Disambiguate joins by adding explicit FK to profiles (safe since profiles.id = auth.users.id)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_profiles_user_id_fkey') THEN
        ALTER TABLE public.attendance ADD CONSTRAINT attendance_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
    END IF;
END $$;


-- 3) Helper: Extract client IP from Supabase request headers
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS TEXT AS $$
DECLARE
  headers JSONB;
  xff TEXT;
BEGIN
  headers := current_setting('request.headers', true)::jsonb;
  xff := headers->>'x-forwarded-for';
  IF xff IS NOT NULL THEN
    -- Return the first IP in the forwarded chain
    RETURN TRIM(split_part(xff, ',', 1));
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Helper: Validate IP and Role for Attendance Actions
CREATE OR REPLACE FUNCTION public.validate_attendance_context(p_user_id UUID)
RETURNS TABLE (
    ip_address TEXT,
    is_valid BOOLEAN,
    is_override BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_client_ip TEXT;
    v_role TEXT;
    v_is_allowed BOOLEAN;
BEGIN
    v_client_ip := public.get_client_ip();
    
    -- 1. Fetch user role
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
    
    -- 2. Check if IP is in allowed list (supports CIDR ranges)
    SELECT EXISTS (
        SELECT 1 FROM public.allowed_ips 
        WHERE (v_client_ip::INET <<= ip_address::INET) AND is_active = TRUE
    ) INTO v_is_allowed;

    -- 3. Logic: Allow if IP is valid OR user is HR/Admin/SuperAdmin
    IF v_is_allowed THEN
        RETURN QUERY SELECT v_client_ip, TRUE, FALSE, 'Valid office network'::TEXT;
    ELSIF v_role IN ('hr', 'admin', 'super_admin') THEN
        RETURN QUERY SELECT v_client_ip, TRUE, TRUE, 'Admin override'::TEXT;
    ELSE
        RETURN QUERY SELECT v_client_ip, FALSE, FALSE, 'Attendance actions are allowed only from approved office network.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Public Check (For UI Feedback)
CREATE OR REPLACE FUNCTION public.check_ip_validity()
RETURNS JSONB AS $$
DECLARE
    v_ip TEXT;
    v_valid BOOLEAN;
BEGIN
    v_ip := public.get_client_ip();
    SELECT EXISTS (
        SELECT 1 FROM public.allowed_ips 
        WHERE (v_ip::INET <<= ip_address::INET) AND is_active = TRUE
    ) INTO v_valid;
    
    RETURN jsonb_build_object(
        'ip', v_ip,
        'is_office_network', v_valid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Secure Punch In v2
CREATE OR REPLACE FUNCTION public.attendance_punch_in_v2(p_user_id UUID)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ctx RECORD;
    v_row public.attendance%ROWTYPE;
BEGIN
    -- Validate Context
    SELECT * INTO v_ctx FROM public.validate_attendance_context(p_user_id);
    
    IF NOT v_ctx.is_valid THEN
        RAISE EXCEPTION 'IP_RESTRICTED: %', v_ctx.reason;
    END IF;

    -- Call original logic (re-implemented here to ensure atomicity and audit logging)
    INSERT INTO public.attendance (
        user_id, 
        attendance_date, 
        punch_in_time, 
        status,
        ip_address,
        validation_status,
        is_override,
        validation_reason
    )
    VALUES (
        p_user_id, 
        public.get_today_ist(), 
        now(), 
        'punched_in',
        v_ctx.ip_address,
        CASE WHEN v_ctx.is_override THEN 'OVERRIDDEN' ELSE 'VALID' END,
        v_ctx.is_override,
        v_ctx.reason
    )
    ON CONFLICT (user_id, attendance_date)
    DO UPDATE SET
        punch_in_time = COALESCE(public.attendance.punch_in_time, EXCLUDED.punch_in_time),
        punch_out_time = NULL,
        total_hours = NULL,
        status = 'punched_in',
        ip_address = EXCLUDED.ip_address,
        validation_status = EXCLUDED.validation_status,
        is_override = EXCLUDED.is_override,
        validation_reason = EXCLUDED.validation_reason
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- 7) Secure Punch Out v2
CREATE OR REPLACE FUNCTION public.attendance_punch_out_v2(p_record_id UUID, p_lunch_duration_ms BIGINT DEFAULT 0)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.attendance%ROWTYPE;
    v_ctx RECORD;
    v_now TIMESTAMPTZ := now();
    v_diff_ms BIGINT;
    v_net_ms BIGINT;
    v_hours NUMERIC(5,2);
    v_status TEXT := 'punched_out';
BEGIN
    SELECT * INTO v_row FROM public.attendance WHERE id = p_record_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attendance record not found'; END IF;

    -- Validate Context
    SELECT * INTO v_ctx FROM public.validate_attendance_context(v_row.user_id);
    IF NOT v_ctx.is_valid THEN RAISE EXCEPTION 'IP_RESTRICTED: %', v_ctx.reason; END IF;

    -- Calculations
    v_diff_ms := FLOOR(EXTRACT(EPOCH FROM (v_now - v_row.punch_in_time)) * 1000);
    v_net_ms := GREATEST(0, v_diff_ms - COALESCE(p_lunch_duration_ms, 0));
    v_hours := ROUND((v_net_ms::numeric / 3600000)::numeric, 2);

    IF v_hours > 8 THEN
        v_hours := 8.00;
        v_status := 'auto_punched_out';
    END IF;

    UPDATE public.attendance
    SET punch_out_time = v_now,
        total_hours = v_hours,
        status = v_status,
        ip_address = v_ctx.ip_address,
        validation_status = CASE WHEN v_ctx.is_override THEN 'OVERRIDDEN' ELSE 'VALID' END,
        is_override = v_ctx.is_override,
        validation_reason = v_ctx.reason
    WHERE id = p_record_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- 8) Secure Overtime RPCs
CREATE OR REPLACE FUNCTION public.attendance_start_overtime_v2(p_record_id UUID)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.attendance%ROWTYPE;
    v_ctx RECORD;
BEGIN
    SELECT * INTO v_row FROM public.attendance WHERE id = p_record_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attendance record not found'; END IF;

    -- Validate Context
    SELECT * INTO v_ctx FROM public.validate_attendance_context(v_row.user_id);
    IF NOT v_ctx.is_valid THEN RAISE EXCEPTION 'IP_RESTRICTED: %', v_ctx.reason; END IF;

    UPDATE public.attendance
    SET overtime_start_time = now(),
        ip_address = v_ctx.ip_address
    WHERE id = p_record_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_end_overtime_v2(p_record_id UUID)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.attendance%ROWTYPE;
    v_ctx RECORD;
    v_now TIMESTAMPTZ := now();
    v_duration_ms BIGINT;
BEGIN
    SELECT * INTO v_row FROM public.attendance WHERE id = p_record_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attendance record not found'; END IF;
    IF v_row.overtime_start_time IS NULL THEN RAISE EXCEPTION 'Overtime not started'; END IF;

    -- Validate Context
    SELECT * INTO v_ctx FROM public.validate_attendance_context(v_row.user_id);
    IF NOT v_ctx.is_valid THEN RAISE EXCEPTION 'IP_RESTRICTED: %', v_ctx.reason; END IF;

    v_duration_ms := FLOOR(EXTRACT(EPOCH FROM (v_now - v_row.overtime_start_time)) * 1000);

    UPDATE public.attendance
    SET overtime_end_time = v_now,
        overtime_duration_ms = v_duration_ms,
        ip_address = v_ctx.ip_address
    WHERE id = p_record_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.check_ip_validity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_punch_in_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_punch_out_v2(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_start_overtime_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_end_overtime_v2(UUID) TO authenticated;

COMMIT;
