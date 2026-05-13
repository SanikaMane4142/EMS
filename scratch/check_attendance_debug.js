import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendance() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  console.log('Today (IST):', today);

  const { data, error } = await supabase
    .from('attendance')
    .select('*, profiles(full_name, email)')
    .eq('attendance_date', today);

  if (error) {
    console.error('Error fetching attendance:', error);
    
    // Try with explicit relationship hint
    const { data: data2, error: error2 } = await supabase
      .from('attendance')
      .select('*, profiles!user_id(full_name, email)')
      .eq('attendance_date', today);
    
    if (error2) {
      console.error('Error fetching attendance with hint:', error2);
    } else {
      console.log('Success with hint! Data:', data2);
    }
  } else {
    console.log('Success! Data:', data);
  }
}

checkAttendance();
