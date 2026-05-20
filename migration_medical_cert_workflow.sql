-- =============================================================================
-- EMS PORTAL — DELAYED MEDICAL CERTIFICATE UPLOAD MIGRATION
-- =============================================================================
-- This file applies database changes for the medical certificate grace period,
-- verification workflow, and auto-conversion system.
-- Run this in the Supabase SQL editor.
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

-- 6. Storage Bucket Security Setup
-- Note: Run storage setups directly in the Supabase Dashboard if bucket does not exist.
-- Assuming bucket 'medical-certificates' is created.

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

-- Refresh cache
NOTIFY pgrst, 'reload schema';
