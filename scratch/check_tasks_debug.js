import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTasks() {
    console.log('Checking tasks table...');
    const { data, error } = await supabase
        .from('tasks')
        .select('*');

    if (error) {
        console.error('Error fetching tasks:', error);
    } else {
        console.log('Total tasks found:', data ? data.length : 0);
        console.log('Tasks:', JSON.stringify(data, null, 2));
    }

    console.log('\nChecking profiles table...');
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, role');
    
    if (pError) {
        console.error('Error fetching profiles:', pError);
    } else {
        console.log('Profiles:', JSON.stringify(profiles, null, 2));
    }
}

checkTasks();
