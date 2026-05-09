import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTasks() {
    // Try to fetch tasks directly
    const { data, error } = await supabase.from('tasks').select('count', { count: 'exact' });
    console.log('Task count check:', { count: data?.[0]?.count, error });

    // Try to fetch one task
    const { data: oneTask, error: err2 } = await supabase.from('tasks').select('*').limit(1);
    console.log('One task check:', { oneTask, error: err2 });
}

checkTasks();
