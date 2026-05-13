-- =============================================================================
-- MIGRATION: Attendance + Leave + Absence Explanation Workflow
-- Date: 2026-05-13
-- =============================================================================

BEGIN;

-- 0) Normalize legacy attendance nullability for non-punched day states
ALTER TABLE public.attendance
  ALTER COLUMN punch_in_time DROP NOT NULL,
  ALTER COLUMN punch_out_time DROP NOT NULL,
  ALTER COLUMN total_hours DROP NOT NULL;

-- 1) Expand attendance statuses
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

-- 2) Absent explanation workflow table
CREATE TABLE IF NOT EXISTS public.attendance_explanations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_explanations_one_per_day UNIQUE (attendance_id)
);

-- update trigger for updated_at
DROP TRIGGER IF EXISTS trg_attendance_explanations_updated_at ON public.attendance_explanations;
CREATE TRIGGER trg_attendance_explanations_updated_at
  BEFORE UPDATE ON public.attendance_explanations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RLS + policies for attendance_explanations
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

-- 4) Deterministic status resolver per user/day
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
BEGIN
  -- Ensure daily attendance row exists
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

-- 5) Range sync for leave changes (handles day-2 approvals / retroactive updates)
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

-- 6) Trigger to auto-sync attendance when leave status/date range changes
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

-- 7) Trigger to sync attendance when explanation is inserted/updated
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

-- 8) One-time backfill for existing approved leaves
DO $$
DECLARE
  v_leave RECORD;
BEGIN
  FOR v_leave IN
    SELECT id FROM public.leave_requests WHERE status = 'approved'
  LOOP
    PERFORM public.sync_attendance_for_leave_request(v_leave.id);
  END LOOP;
END $$;

-- 9) Schema cache refresh
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- PATCH: Server-Time RPCs (device clock hardening)
-- Date: 2026-05-16
-- =============================================================================

BEGIN;

-- Server-side IST "today" helper
CREATE OR REPLACE FUNCTION public.get_today_ist()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('Asia/Kolkata', now()))::date;
$$;

-- Server-side IST "now" helper
CREATE OR REPLACE FUNCTION public.get_now_ist()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT timezone('Asia/Kolkata', now());
$$;

-- Punch In using server clock only
CREATE OR REPLACE FUNCTION public.attendance_punch_in(p_user_id UUID)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := public.get_today_ist();
  v_now   TIMESTAMPTZ := now();
  v_row   public.attendance%ROWTYPE;
BEGIN
  INSERT INTO public.attendance (user_id, attendance_date, punch_in_time, punch_out_time, total_hours, status)
  VALUES (p_user_id, v_today, v_now, NULL, NULL, 'punched_in')
  ON CONFLICT (user_id, attendance_date)
  DO UPDATE SET
    punch_in_time = COALESCE(public.attendance.punch_in_time, EXCLUDED.punch_in_time),
    punch_out_time = NULL,
    total_hours = NULL,
    status = 'punched_in'
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Punch Out using server clock only
CREATE OR REPLACE FUNCTION public.attendance_punch_out(p_record_id UUID, p_lunch_duration_ms BIGINT DEFAULT 0)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_diff_ms BIGINT;
  v_net_ms BIGINT;
  v_hours NUMERIC(5,2);
  v_status TEXT := 'punched_out';
BEGIN
  SELECT * INTO v_row FROM public.attendance WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;
  IF v_row.punch_in_time IS NULL THEN
    RAISE EXCEPTION 'Cannot punch out without punch in';
  END IF;

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
      status = v_status
  WHERE id = p_record_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Start/End lunch break using server clock only
CREATE OR REPLACE FUNCTION public.attendance_start_lunch_break(p_record_id UUID)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance%ROWTYPE;
BEGIN
  UPDATE public.attendance
  SET lunch_start_time = now()
  WHERE id = p_record_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_end_lunch_break(
  p_record_id UUID,
  p_current_duration_ms BIGINT DEFAULT 0,
  p_delay_reason TEXT DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_break_ms BIGINT;
  v_new_duration BIGINT;
BEGIN
  SELECT * INTO v_row FROM public.attendance WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;
  IF v_row.lunch_start_time IS NULL THEN
    RAISE EXCEPTION 'Lunch break is not active';
  END IF;

  v_break_ms := FLOOR(EXTRACT(EPOCH FROM (v_now - v_row.lunch_start_time)) * 1000);
  v_new_duration := COALESCE(p_current_duration_ms, 0) + GREATEST(0, v_break_ms);

  UPDATE public.attendance
  SET lunch_start_time = NULL,
      lunch_end_time = v_now,
      lunch_duration_ms = v_new_duration,
      lunch_delay_reason = COALESCE(p_delay_reason, lunch_delay_reason)
  WHERE id = p_record_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_ist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_now_ist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_punch_in(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_punch_out(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_start_lunch_break(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_end_lunch_break(UUID, BIGINT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
