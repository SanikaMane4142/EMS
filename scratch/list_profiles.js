
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './ems-frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*');
    
    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }
    
    console.log('Profiles:', data);
}

listProfiles();
