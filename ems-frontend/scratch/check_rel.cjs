const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
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

async function checkRelationships() {
    console.log('Checking table relationships/constraints...');
    
    // We can try to guess or use PostgREST introspection if we had access.
    // Since we don't have service_role, we can try to "break" a query to see the error message.
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*, departments(*)');
    
    if (error) {
        console.log('Introspection attempt 1 (profiles -> departments):', error.message);
        console.log('Error hint:', error.hint);
    } else {
        console.log('profiles -> departments works with default name.');
    }

    const { data: data2, error: error2 } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!assigned_to(*)');
    
    if (error2) {
        console.log('Introspection attempt 2 (tasks -> profiles via assigned_to):', error2.message);
    } else {
        console.log('tasks -> profiles via assigned_to works.');
    }
}

checkRelationships();
