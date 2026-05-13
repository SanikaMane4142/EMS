const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  console.log('Checking profiles visibility...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role');

  if (error) {
    console.error('Error fetching profiles:', error.message);
    return;
  }

  console.log(`Successfully fetched ${data.length} profiles.`);
  if (data.length > 0) {
    console.table(data);
  } else {
    console.log('No profiles visible to anon role (or table is empty).');
  }
}

checkProfiles();
