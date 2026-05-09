import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendanceSchema() {
  const { data, error } = await supabase.from('attendance').select('*').limit(1);
  if (error) {
    console.log('Error checking attendance:', error.message);
  } else {
    console.log('Attendance Columns:', data[0] ? Object.keys(data[0]) : 'Empty table');
    if (data[0]) console.log('Sample row:', data[0]);
  }
}

checkAttendanceSchema();
