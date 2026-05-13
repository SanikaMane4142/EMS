const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
    console.error('.env file not found at:', envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('Checking Schema...');

    // We can't use information_schema with anon key usually, but we can try to select 1 row and check keys
    const tables = ['tasks', 'task_groups', 'subtasks', 'profiles'];
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error selecting from ${table}:`, error.message);
        } else {
            if (data && data.length > 0) {
                console.log(`Columns in ${table}:`, Object.keys(data[0]));
            } else {
                console.log(`${table} is empty.`);
            }
        }
    }
}

checkSchema();
