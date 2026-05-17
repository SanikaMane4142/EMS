/**
 * EMS Office IP Heartbeat Service
 * ================================
 * Runs on the always-on office server/PC.
 * Every HEARTBEAT_INTERVAL_MS (default 5 min) it:
 *   1. Fetches the office's current public IP
 *   2. Updates office_ip_heartbeat in Supabase via service_role key
 *   3. Logs any IP changes to ip_change_log
 *
 * SECURITY: Uses service_role key — NEVER put this key in the React frontend.
 *
 * Setup:
 *   1. Copy .env.example → .env and fill in your values
 *   2. npm install
 *   3. node heartbeat.js   (or use PM2: pm2 start heartbeat.js --name ems-heartbeat)
 */

'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OFFICE_ID           = process.env.OFFICE_ID   || 'main_office';
const OFFICE_NAME         = process.env.OFFICE_NAME || 'Main Office';
const INTERVAL_MS         = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '300000', 10); // 5 min

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[Heartbeat] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase client (service_role — bypasses RLS)
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ---------------------------------------------------------------------------
// IP Providers — tried in order, first success wins
// ---------------------------------------------------------------------------
const IP_PROVIDERS = [
  { url: 'https://api.ipify.org?format=json', key: 'ip' },
  { url: 'https://api.my-ip.io/v2/ip.json',   key: 'ip' },
  { url: 'https://httpbin.org/ip',             key: 'origin' },
];

async function getPublicIP() {
  for (const provider of IP_PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res  = await fetch(provider.url, { signal: controller.signal });
      clearTimeout(timeout);

      const data = await res.json();
      const ip   = data[provider.key]?.split(',')[0]?.trim(); // handle comma-separated
      if (ip) return ip;
    } catch (err) {
      console.warn(`[Heartbeat] Provider ${provider.url} failed: ${err.message}`);
    }
  }
  throw new Error('All IP providers failed — check internet connection');
}

// ---------------------------------------------------------------------------
// Main heartbeat function
// ---------------------------------------------------------------------------
async function heartbeat() {
  const timestamp = new Date().toISOString();

  let currentIp;
  try {
    currentIp = await getPublicIP();
  } catch (err) {
    console.error(`[Heartbeat] ❌ ${timestamp} — ${err.message}`);
    return; // Skip this beat — don't update Supabase with bad data
  }

  try {
    // Fetch existing record
    const { data: existing, error: fetchErr } = await supabase
      .from('office_ip_heartbeat')
      .select('*')
      .eq('office_id', OFFICE_ID)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    const ipChanged = existing && existing.current_ip !== currentIp;

    // Upsert heartbeat
    const { error: upsertErr } = await supabase
      .from('office_ip_heartbeat')
      .upsert({
        office_id:          OFFICE_ID,
        office_name:        OFFICE_NAME,
        current_ip:         currentIp,
        previous_ip:        ipChanged ? existing.current_ip : (existing?.previous_ip ?? null),
        last_heartbeat_at:  timestamp,
        ip_changed_at:      ipChanged ? timestamp : (existing?.ip_changed_at ?? null),
        heartbeat_count:    (existing?.heartbeat_count ?? 0) + 1,
        is_active:          true,
      }, { onConflict: 'office_id' });

    if (upsertErr) throw upsertErr;

    if (ipChanged) {
      // Log the IP change
      await supabase.from('ip_change_log').insert({
        office_id:     OFFICE_ID,
        old_ip:        existing.current_ip,
        new_ip:        currentIp,
        change_source: 'heartbeat_auto',
        metadata: {
          heartbeat_count: (existing?.heartbeat_count ?? 0) + 1,
          office_name: OFFICE_NAME,
        }
      });
      console.log(`[Heartbeat] 🔄 ${timestamp} — IP CHANGED: ${existing.current_ip} → ${currentIp}`);
    } else {
      const beat = (existing?.heartbeat_count ?? 0) + 1;
      console.log(`[Heartbeat] ✅ ${timestamp} — OK | IP: ${currentIp} | Beat #${beat}`);
    }
  } catch (err) {
    console.error(`[Heartbeat] ❌ Supabase error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
console.log(`[Heartbeat] 🚀 Starting for "${OFFICE_NAME}" (${OFFICE_ID})`);
console.log(`[Heartbeat] 📡 Interval: ${INTERVAL_MS / 1000}s | Supabase: ${SUPABASE_URL}`);

// First beat immediately
heartbeat();

// Then on interval
setInterval(heartbeat, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT',  () => { console.log('\n[Heartbeat] Stopped.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[Heartbeat] Stopped.'); process.exit(0); });
