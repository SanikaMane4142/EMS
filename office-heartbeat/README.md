# EMS Office Heartbeat Service

Keeps the EMS Portal's office IP automatically updated in Supabase. No more manual IP changes when your ISP refreshes the connection.

---

## How It Works

1. Every **5 minutes**, this script fetches the office's current public IP
2. If the IP changed → updates `office_ip_heartbeat` table in Supabase
3. Employee punch-ins validate against this live IP instead of a static entry

---

## Prerequisites

- Node.js 18+ installed on the office PC/server
- Always-on machine (desktop or server that doesn't sleep/shutdown)
- Internet connection (obviously 😄)

---

## Setup

### 1. Copy the environment file
```bash
copy .env.example .env
```

### 2. Edit `.env` with your values
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

OFFICE_ID=main_office
OFFICE_NAME=Main Office
HEARTBEAT_INTERVAL_MS=300000
```

> ⚠️ **Where to find your service role key:**
> Supabase Dashboard → Project Settings → API → `service_role` (secret) key

### 3. Install dependencies
```bash
npm install
```

### 4. Run it
```bash
node heartbeat.js
```

---

## Running as a Background Service (Recommended)

### Option A: PM2 (Linux/Mac/Windows)
```bash
npm install -g pm2
pm2 start heartbeat.js --name ems-heartbeat
pm2 save
pm2 startup   # Auto-start on reboot
```

### Option B: Windows Task Scheduler
1. Open Task Scheduler → Create Basic Task
2. Trigger: **At system startup**
3. Action: Start a program → `node.exe`
4. Arguments: `C:\path\to\office-heartbeat\heartbeat.js`
5. Start in: `C:\path\to\office-heartbeat`

### Option C: node-windows (Windows Service)
```bash
npm install -g node-windows
node install-service.js  # (create this file if needed)
```

---

## Monitoring

Check the logs:
- **PM2**: `pm2 logs ems-heartbeat`
- **Console**: watch for `✅ OK` every 5 min or `🔄 IP CHANGED` alerts

In the EMS Portal, admins can view heartbeat status at:
**Network Security → Heartbeat Status** panel

---

## Security Notes

- ✅ Uses `service_role` key — the ONLY writer to `office_ip_heartbeat`
- ✅ Employees and admins in the browser **cannot** write to this table (RLS blocks them)
- ❌ **Never** commit `.env` to git (it's in `.gitignore`)
- ❌ **Never** put `SUPABASE_SERVICE_ROLE_KEY` in the React frontend or Vercel env vars
