import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pflcpzwwokcynwreqjho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGNwend3b2tjeW53cmVxamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc5MjAsImV4cCI6MjA5MjkyMzkyMH0.HAAUEO8u_KIoqWxLpunqK5I2ahbbvXsW7haYebuBfGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkHR() {
    console.log('Checking hr@gmail.com profile...');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'hr@gmail.com');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Profile:', JSON.stringify(data, null, 2));
    }
}

checkHR();
