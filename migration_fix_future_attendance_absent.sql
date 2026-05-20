-- =============================================================================
-- EMS PORTAL — FUTURE ATTENDANCE ABSENT FIX
-- =============================================================================
-- This migration fixes the bug where future dates are marked as 'absent'
-- when a leave request is submitted or updated.
-- Run this in the Supabase SQL editor.
-- =============================================================================

BEGIN;

-- 1. Correct the status recomputation function to handle future dates
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

-- 2. Clean up any incorrect future absent/explanation placeholder rows from the database
DELETE FROM public.attendance
WHERE attendance_date > public.get_today_ist()
  AND punch_in_time IS NULL;

-- 3. Reload Schema
NOTIFY pgrst, 'reload schema';

COMMIT;
