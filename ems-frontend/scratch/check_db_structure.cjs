const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Checking tasks table columns...');
  const { data: tasks, error: tError } = await supabase.from('tasks').select('*').limit(1);
  if (tError) console.error('Tasks error:', tError);
  else console.log('Tasks sample:', tasks[0] ? Object.keys(tasks[0]) : 'Empty table');

  console.log('Checking profiles table columns...');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(1);
  if (pError) console.error('Profiles error:', pError);
  else console.log('Profiles sample:', profiles[0] ? Object.keys(profiles[0]) : 'Empty table');
}

check();
