-- =============================================================================
-- EMS PORTAL — UNIFIED IP VALIDATION FOR OVERTIME (HEARTBEAT + ALLOWED IPS)
-- =============================================================================
-- This migration updates the validate_attendance_context helper function.
-- It ensures that starting/ending overtime uses the exact same IP check as
-- punch in/out (checking office heartbeat first, with allowed_ips fallback).
-- Run this in the Supabase SQL editor.
-- =============================================================================

BEGIN;

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
    v_office_ip TEXT;
    v_heartbeat_age INTERVAL;
    v_is_allowed BOOLEAN := FALSE;
BEGIN
    -- 1. Get client IP from headers (supports x-real-ip and x-forwarded-for)
    v_client_ip := COALESCE(
        current_setting('request.headers', true)::json->>'x-real-ip',
        split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)
    );
    v_client_ip := TRIM(v_client_ip);

    -- Fallback to get_client_ip() helper if headers aren't JSON-formatted
    IF v_client_ip IS NULL OR v_client_ip = '' THEN
        v_client_ip := public.get_client_ip();
    END IF;

    -- 2. Fetch user role
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

    -- 3. Role override (HR, Admin, Super Admin bypass IP check)
    IF v_role IN ('hr', 'admin', 'super_admin') THEN
        RETURN QUERY SELECT v_client_ip, TRUE, TRUE, 'Admin override'::TEXT;
        RETURN;
    END IF;

    -- 4. Fetch the latest office heartbeat
    SELECT current_ip::TEXT, (now() - last_heartbeat_at)
    INTO v_office_ip, v_heartbeat_age
    FROM public.office_ip_heartbeat
    WHERE is_active = true
    ORDER BY last_heartbeat_at DESC
    LIMIT 1;

    -- 5. Safe validation block (handles invalid IP string casts gracefully)
    BEGIN
        -- Heartbeat check (fresh office network validation)
        IF v_office_ip IS NOT NULL AND v_heartbeat_age <= INTERVAL '15 minutes' THEN
            IF v_client_ip::INET = v_office_ip::INET THEN
                RETURN QUERY SELECT v_client_ip, TRUE, FALSE, format('Valid office network (heartbeat match: %s)', v_client_ip)::TEXT;
                RETURN;
            END IF;
        END IF;

        -- Fallback check: allowed_ips table
        SELECT EXISTS (
            SELECT 1 FROM public.allowed_ips 
            WHERE (v_client_ip::INET <<= ip_address::INET) AND is_active = TRUE
        ) INTO v_is_allowed;
    EXCEPTION WHEN OTHERS THEN
        v_is_allowed := FALSE;
    END;

    IF v_is_allowed THEN
        RETURN QUERY SELECT v_client_ip, TRUE, FALSE, format('Valid office network (fallback allowed_ips match: %s)', v_client_ip)::TEXT;
    ELSE
        RETURN QUERY SELECT v_client_ip, FALSE, FALSE, format('IP_RESTRICTED: IP %s not recognized as office network (heartbeat or allowed_ips)', COALESCE(v_client_ip, 'unknown'))::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload Schema to notify PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
