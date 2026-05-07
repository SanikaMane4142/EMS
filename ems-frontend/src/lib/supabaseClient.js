import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

// Ensure the URL is a valid format to prevent createClient from throwing a synchronous error
const validUrl = supabaseUrl?.startsWith('http') ? supabaseUrl : 'https://dummy.supabase.co';
const validKey = supabaseAnonKey || 'dummy-key';

export const supabase = createClient(validUrl, validKey);
