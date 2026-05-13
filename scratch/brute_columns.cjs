const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const columns = ['id', 'title', 'sort_order', 'is_completed', 'is_complete', 'completed', 'status'];
  for (const col of columns) {
    const { error } = await supabase.from('task_groups').select(col).limit(1);
    if (error) {
      console.log(`Column ${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column ${col}: EXISTS`);
    }
  }
}

check();
