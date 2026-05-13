import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFKs() {
    console.log('Checking constraints...');
    // We can't query information_schema with anon key usually, but let's try a simple select that might fail
    const { data, error } = await supabase.rpc('get_constraints'); // If they have it
    if (error) {
        console.log('RPC get_constraints failed, trying raw query via a known table if possible');
    }

    // Let's try to fetch a task with a simple select first to see if it works at all
    const { data: tasks, error: tError } = await supabase.from('tasks').select('id, title');
    console.log('Simple tasks fetch:', { count: tasks?.length, error: tError });
}

checkFKs();
