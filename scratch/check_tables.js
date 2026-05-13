import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase
    .from('attendance')
    .select('count', { count: 'exact', head: true });

  if (error) {
    console.error('Error checking attendance table:', error);
  } else {
    console.log('Attendance table exists. Row count:', data);
  }
}

checkTables();
