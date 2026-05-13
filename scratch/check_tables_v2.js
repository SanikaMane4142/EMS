import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { count, error } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error checking attendance table:', error);
  } else {
    console.log('Attendance table exists. Row count:', count);
  }
  
  const { data: cols, error: colErr } = await supabase
    .from('attendance')
    .select('*')
    .limit(1);
    
  if (colErr) {
    console.error('Error fetching one row:', colErr);
  } else {
    console.log('One row sample (to check columns):', cols);
  }
}

checkTables();
