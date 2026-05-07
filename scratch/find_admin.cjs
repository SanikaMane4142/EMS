
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.resolve(__dirname, '../ems-frontend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listSuperAdmins() {
    const { data, error } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('role', 'super_admin');
    
    if (error) {
        console.error('Error fetching super admins:', error);
        return;
    }
    
    console.log('Super Admins:', data);
}

listSuperAdmins();
