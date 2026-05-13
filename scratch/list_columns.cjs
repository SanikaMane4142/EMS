const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  // Use a hack to get column names: query a non-existent column and hope for a helpful error message
  // Or better, query the table and if it's empty, we might still get the schema if we use a different approach.
  // Actually, let's try to insert a dummy row and then delete it? No, anon key might not have insert.
  
  // Let's try to select all and see if we get an error or something.
  const { data, error } = await supabase.from('task_groups').select('*').limit(1);
  if (error) {
    console.error('Error selecting *:', error);
  } else {
    console.log('Data:', data);
  }
}

check();
