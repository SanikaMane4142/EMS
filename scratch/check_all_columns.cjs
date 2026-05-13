const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const tables = ['tasks', 'task_groups', 'subtasks'];
  const columnsToCheck = ['is_completed', 'is_complete', 'completed', 'status', 'progress'];
  
  for (const table of tables) {
    console.log(`Checking table: ${table}`);
    for (const col of columnsToCheck) {
      const { error } = await supabase.from(table).select(col).limit(1);
      if (error) {
        if (error.code === '42703') {
           // Column doesn't exist
        } else {
           console.log(`  ${col}: ERROR (${error.message})`);
        }
      } else {
        console.log(`  ${col}: EXISTS`);
      }
    }
  }
}

check();
