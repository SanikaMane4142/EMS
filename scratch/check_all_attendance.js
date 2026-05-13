import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllAttendance() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, profiles(full_name, email)')
    .order('attendance_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching attendance:', error);
  } else {
    console.log('Last 10 attendance records:', data);
  }
}

checkAllAttendance();
