-- =============================================================================
-- MIGRATION: User Documents Management
-- Description: Creates the user_documents table and necessary RLS policies.
-- =============================================================================

-- 1. Create the user_documents table
CREATE TABLE IF NOT EXISTS public.user_documents (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category    TEXT        NOT NULL CHECK (category IN ('Joining', 'Verification', 'Payslip', 'Policy', 'Other')),
    title       TEXT        NOT NULL,
    file_name   TEXT        NOT NULL,
    file_url    TEXT        NOT NULL,
    file_size   INTEGER,    -- Size in bytes
    file_type   TEXT,       -- e.g., 'application/pdf'
    uploaded_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_user_documents_updated_at ON public.user_documents;
CREATE TRIGGER trg_user_documents_updated_at
    BEFORE UPDATE ON public.user_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own documents
DROP POLICY IF EXISTS "documents_view_own" ON public.user_documents;
CREATE POLICY "documents_view_own" ON public.user_documents FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Policy: HR, Admin, Super Admin can view all documents
DROP POLICY IF EXISTS "documents_view_all_hr" ON public.user_documents;
CREATE POLICY "documents_view_all_hr" ON public.user_documents FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('hr', 'admin', 'super_admin')
        )
    );

-- Policy: Employees can insert their own Verification documents
DROP POLICY IF EXISTS "documents_insert_own" ON public.user_documents;
CREATE POLICY "documents_insert_own" ON public.user_documents FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND auth.uid() = uploaded_by AND category = 'Verification');

-- Policy: Users can delete documents they uploaded
DROP POLICY IF EXISTS "documents_delete_own" ON public.user_documents;
CREATE POLICY "documents_delete_own" ON public.user_documents FOR DELETE TO authenticated
    USING (auth.uid() = uploaded_by);

-- Policy: HR, Admin, Super Admin can insert/update/delete any document
DROP POLICY IF EXISTS "documents_manage_hr" ON public.user_documents;
CREATE POLICY "documents_manage_hr" ON public.user_documents FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('hr', 'admin', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('hr', 'admin', 'super_admin')
        )
    );

-- Note: You also need to create a new Supabase Storage bucket named 'documents' 
-- and configure its RLS policies to allow authenticated users to upload/read.

-- Add to Realtime Publication (optional, if you want real-time updates)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_documents') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_documents;
    END IF;
END $$;
