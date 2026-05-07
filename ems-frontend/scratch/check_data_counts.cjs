const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('Checking counts...');
  
  const { count: taskCount, error: taskError } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true });
    
  const { count: groupCount, error: groupError } = await supabase
    .from('task_groups')
    .select('*', { count: 'exact', head: true });

  const { count: profileCount, error: profileError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  console.log('Tasks:', taskCount, taskError ? taskError.message : '');
  console.log('Groups:', groupCount, groupError ? groupError.message : '');
  console.log('Profiles:', profileCount, profileError ? profileError.message : '');
  
  if (profileCount > 0) {
      console.log('\nProfiles sample:');
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').limit(5);
      console.log(profiles);
  }
}

checkData();
