const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TASK_SELECT = `
  *,
  task_groups ( id, title, sort_order, subtasks ( id, title, is_completed, due_date, sort_order ) ),
  assignee:profiles!assigned_to ( id, full_name, employee_id, department_id, departments!profiles_department_id_fkey ( name ) ),
  assigner:profiles!assigned_by ( id, full_name )
`;

async function check() {
  console.log('Testing TASK_SELECT query...');
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .limit(1);

  if (error) {
    console.error('Query Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Query Success:', JSON.stringify(data, null, 2));
  }
}

check();
