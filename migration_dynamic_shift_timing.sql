-- =============================================================================
-- EMS PORTAL — DYNAMIC SHIFT TIMING (8 HOURS vs 9 HOURS)
-- =============================================================================
-- This migration updates attendance-related stored procedures (RPCs) to use
-- a dynamic shift duration based on the employee_id.
-- Run this in the Supabase SQL editor.
-- =============================================================================

BEGIN;

-- Helper function to get shift hours for a user
CREATE OR REPLACE FUNCTION public.get_employee_shift_hours(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emp_id TEXT;
    v_shift_hours NUMERIC := 9;
BEGIN
    SELECT employee_id INTO v_emp_id FROM public.profiles WHERE id = p_user_id;
    IF v_emp_id IN ('FS-CO002', 'AI-CO004', 'UIUX-CO007') THEN
        v_shift_hours := 8;
    END IF;
    RETURN v_shift_hours;
END;
$$;

-- 1. Update attendance_punch_out_v3 to cap regular hours dynamically
DROP FUNCTION IF EXISTS public.attendance_punch_out_v3(UUID, BIGINT);
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
    v_heartbeat_age     INTERVAL;
    v_is_valid          BOOLEAN := FALSE;
    v_validation_method TEXT;
    v_record            RECORD;
    v_net_seconds       NUMERIC;
    v_total_hours       NUMERIC;
    v_shift_hours       NUMERIC;
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

    -- 5. Get dynamic shift hours
    v_shift_hours := public.get_employee_shift_hours(v_record.user_id);

    -- 6. Update record (Cap regular hours dynamically)
    UPDATE public.attendance
    SET
        punch_out_time      = now(),
        total_hours         = LEAST(v_total_hours, v_shift_hours),
        status              = 'punched_out',
        lunch_duration_ms   = COALESCE(p_lunch_duration_ms, lunch_duration_ms, 0),
        validation_method   = v_validation_method
    WHERE id = p_record_id
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    RETURN v_result;
END;
$$;


-- 2. Update authorized_early_punch_out to credit dynamic hours for full-day approval
DROP FUNCTION IF EXISTS public.authorized_early_punch_out(UUID, TEXT, TEXT, BOOLEAN);
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
    v_caller_id         UUID := auth.uid();
    v_employee_id       UUID;
    v_record            RECORD;
    v_punch_out_time    TIMESTAMPTZ;
    v_actual_hours      NUMERIC;
    v_approved_hours    NUMERIC;
    v_net_seconds       NUMERIC;
    v_lunch_ms          BIGINT;
    v_shift_hours       NUMERIC;
    v_result            JSONB;
BEGIN
    -- 1. Get caller role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('hr', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only HR/Admin can force punch out an employee.';
    END IF;

    -- 2. Get attendance record
    SELECT * INTO v_record FROM public.attendance WHERE id = p_attendance_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record not found.';
    END IF;

    v_employee_id := v_record.user_id;

    -- 3. Check if already punched out
    IF v_record.punch_out_time IS NOT NULL THEN
        RAISE EXCEPTION 'Employee is already punched out.';
    END IF;

    -- 4. If lunch is active, auto-end it
    v_lunch_ms := COALESCE(v_record.lunch_duration_ms, 0);
    IF v_record.lunch_start_time IS NOT NULL AND v_record.lunch_end_time IS NULL THEN
        v_lunch_ms := v_lunch_ms + EXTRACT(EPOCH FROM (now() - v_record.lunch_start_time))::BIGINT * 1000;
    END IF;

    v_punch_out_time := now();

    -- 5. Calculate actual work hours
    v_net_seconds := EXTRACT(EPOCH FROM (v_punch_out_time - v_record.punch_in_time))
                     - (v_lunch_ms / 1000.0);
    v_actual_hours := ROUND((v_net_seconds / 3600.0)::NUMERIC, 2);
    IF v_actual_hours < 0 THEN v_actual_hours := 0; END IF;

    -- 6. Get dynamic shift hours
    v_shift_hours := public.get_employee_shift_hours(v_employee_id);

    -- 7. Determine payable hours
    IF p_mark_full_day THEN
        v_approved_hours := v_shift_hours;
    ELSE
        v_approved_hours := v_actual_hours;
    END IF;

    -- 8. Update record
    UPDATE public.attendance
    SET
        punch_out_time          = v_punch_out_time,
        total_hours             = LEAST(v_actual_hours, v_shift_hours),
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
        lunch_end_time          = CASE
                                    WHEN v_record.lunch_start_time IS NOT NULL AND v_record.lunch_end_time IS NULL
                                    THEN v_punch_out_time
                                    ELSE v_record.lunch_end_time
                                  END
    WHERE id = p_attendance_id
    RETURNING row_to_json(attendance.*)::jsonb INTO v_result;

    -- 9. Insert audit log
    INSERT INTO public.attendance_override_logs (
        attendance_id, employee_id, action_by, action_type,
        old_punch_out, new_punch_out,
        reason, note, approved_full_day, approved_work_hours
    ) VALUES (
        p_attendance_id, v_employee_id, v_caller_id, 'force_punch_out',
        NULL, v_punch_out_time,
        p_reason, p_note, p_mark_full_day, v_approved_hours
    );

    RETURN v_result;
END;
$$;


-- 3. Update employee_approved_early_punch_out to credit dynamic hours for full-day approval
DROP FUNCTION IF EXISTS public.employee_approved_early_punch_out(UUID);
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
    v_shift_hours NUMERIC;
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

    -- 8. Get dynamic shift hours
    v_shift_hours := public.get_employee_shift_hours(v_employee_id);

    -- 9. Determine approved/payable hours
    IF COALESCE(v_request.approved_full_day, FALSE) THEN
        v_approved_hours := v_shift_hours;
    ELSE
        v_approved_hours := v_actual_hours;
    END IF;

    -- 10. Update the attendance record
    UPDATE public.attendance
    SET
        punch_out_time          = v_punch_out_time,
        total_hours             = LEAST(v_actual_hours, v_shift_hours),
        status                  = 'punched_out',
        is_force_punched_out    = TRUE,
        force_punch_out_by      = v_request.reviewer_id,
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

    -- 11. Insert audit log
    INSERT INTO public.attendance_override_logs (
        attendance_id, employee_id, action_by, action_type,
        old_punch_out, new_punch_out,
        reason, note, approved_full_day, approved_work_hours
    ) VALUES (
        p_attendance_id, v_employee_id, v_request.reviewer_id, 'force_punch_out',
        NULL, v_punch_out_time,
        v_request.reason, v_request.note || ' (Employee manually punched out)',
        COALESCE(v_request.approved_full_day, FALSE), v_approved_hours
    );

    RETURN v_result;
END;
$$;


-- 4. Update recompute_attendance_status to check dynamic hours and preserve auto_punched_out
DROP FUNCTION IF EXISTS public.recompute_attendance_status(UUID, DATE);
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
  v_shift_hours NUMERIC;
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

  -- Get dynamic shift hours
  v_shift_hours := public.get_employee_shift_hours(p_user_id);

  -- Highest precedence: any punch activity means present path
  IF v_att.punch_in_time IS NOT NULL THEN
    IF v_att.punch_out_time IS NULL THEN
      v_new_status := 'punched_in';
    ELSE
      -- Check if they were auto-punched-out (either by current status, or if total_hours > shift_hours)
      IF v_att.status = 'auto_punched_out' OR COALESCE(v_att.total_hours, 0) > v_shift_hours THEN
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

-- Reload Schema to notify PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
