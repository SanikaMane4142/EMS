const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTable(table, columns) {
  console.log(`Checking table: ${table}`);
  for (const col of columns) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (error) {
      console.log(`  - ${col}: MISSING (${error.message})`);
    } else {
      console.log(`  - ${col}: EXISTS`);
    }
  }
}

async function run() {
  await checkTable('tasks', ['id', 'title', 'assigned_to', 'assigned_by', 'is_acknowledged', 'sort_order']);
  await checkTable('task_groups', ['id', 'title', 'is_completed', 'sort_order', 'task_id']);
  await checkTable('subtasks', ['id', 'title', 'is_completed', 'due_date', 'sort_order', 'group_id']);
  await checkTable('profiles', ['id', 'full_name', 'employee_id', 'department_id']);
}

run();
