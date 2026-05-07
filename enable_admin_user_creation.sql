-- 1. Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop existing functions to avoid "function not unique" errors when parameters change
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT, UUID);

-- 3. Add code column to departments if it doesn't exist
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code TEXT;

-- 3. Update the RPC function to handle department assignment
CREATE OR REPLACE FUNCTION public.admin_create_user(
    new_email TEXT,
    new_password TEXT,
    new_full_name TEXT,
    new_role TEXT,
    new_department_id UUID DEFAULT NULL -- Added department support
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if the caller is a super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only Super Admins can create users.';
    END IF;

    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        new_email,
        crypt(new_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        format('{"full_name":"%s"}', new_full_name)::jsonb,
        'authenticated',
        'authenticated',
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        format('{"sub":"%s","email":"%s"}', new_user_id, new_email)::jsonb,
        'email',
        new_email,
        now(),
        now(),
        now()
    );

    -- Insert into public.profiles with department assignment
    INSERT INTO public.profiles (id, full_name, email, role, status, department_id)
    VALUES (new_user_id, new_full_name, new_email, new_role, 'active', new_department_id)
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        department_id = EXCLUDED.department_id,
        status = 'active';

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user TO service_role;
