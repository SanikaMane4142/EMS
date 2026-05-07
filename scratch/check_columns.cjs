
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

async function checkColumns() {
    // We can use the RPC or a simple query to see if we can select updated_at
    const { data, error } = await supabase
        .from('profiles')
        .select('updated_at')
        .limit(1);
    
    if (error) {
        console.error('Error selecting updated_at from profiles:', error);
    } else {
        console.log('Successfully selected updated_at from profiles');
    }
}

checkColumns();
