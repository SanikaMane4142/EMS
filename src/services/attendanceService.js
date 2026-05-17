import { supabase } from '../lib/supabaseClient';

/**
 * Returns today's date string in YYYY-MM-DD format using Asia/Kolkata (IST) timezone.
 * This is the SINGLE source of truth for "today" across the entire attendance system.
 */
const getTodayIST = async () => {
  const { data, error } = await supabase.rpc('get_today_ist');
  if (!error && data) return data;
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * Validates if the current device is allowed to perform attendance actions.
 * Rejects mobile/tablet devices or screens below 768px.
 */
const validateDevice = () => {
  if (typeof window === 'undefined') return; // Not in browser

  const isMobileSize = window.innerWidth < 768;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobileSize || isMobileUA) {
    throw new Error("Punch actions are disabled on mobile devices. Please use a desktop to punch in/out.");
  }
};

export const attendanceService = {

  /**
   * Fetch today's attendance record from Supabase.
   * Priority:
   *   1. Any record with status='punched_in' (active shift — recovers after logout)
   *   2. Any record for today's date (covers punched_out / auto_punched_out)
   */
  async getActiveRecord(userId) {
    const today = await getTodayIST();

    // Step 1: Look for an ongoing (punched_in) shift — catches refreshes and post-logout re-logins
    const { data: activeShift, error: activeErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'punched_in')
      .order('punch_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeErr) console.error('getActiveRecord (active) error:', activeErr.message);
    if (activeShift) {
      console.log('[Attendance] Restored active punch-in record:', activeShift.punch_in_time);
      return activeShift;
    }

    // Step 2: No active shift — look for a completed record for today
    const { data: todayRecord, error: todayErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('attendance_date', today)
      .maybeSingle();

    if (todayErr) console.error('getActiveRecord (today) error:', todayErr.message);
    console.log('[Attendance] Today record:', todayRecord);
    return todayRecord || null;
  },

  /**
   * Punch In — upserts to handle duplicate-click gracefully.
   * Uses IST date so the attendance_date column always matches the user's local day.
   */
  async punchIn(userId) {
    validateDevice();
    const { data, error } = await supabase.rpc('attendance_punch_in_v3', {
      p_user_id: userId,
    });

    if (error) throw error;
    console.log('[Attendance] Punched in via heartbeat-validated RPC v3');
    return data;
  },

  /**
   * Punch Out — updates the record and calculates total hours.
   *
   * When isAutoPunchOut = true (triggered at 8h30m by the frontend timer):
   *   - punch_out_time is set to exactly punch_in_time + 8h30m
   *   - total_hours is capped at 8 (regular paid hours)
   *   - status is set to 'auto_punched_out'
   *
   * Otherwise the existing RPC handles the standard manual punch-out.
   */
  async punchOut(recordId, punchInTime, lunchDurationMs = 0, isAutoPunchOut = false) {
    if (!isAutoPunchOut) validateDevice();
    if (isAutoPunchOut) {
      // Auto punch-out: punch_out_time = punch_in_time + 8h30m, total_hours = 8
      const AUTO_SHIFT_MS = 8.5 * 60 * 60 * 1000; // 8h30m in ms
      const punchOutTime = new Date(new Date(punchInTime).getTime() + AUTO_SHIFT_MS);

      const { data, error } = await supabase
        .from('attendance')
        .update({
          punch_out_time: punchOutTime.toISOString(),
          total_hours: 8,          // Regular paid hours only — NOT 8.5
          status: 'auto_punched_out',
        })
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;
      console.log('[Attendance] Auto punch-out complete. punch_out_time:', punchOutTime.toISOString(), '| total_hours: 8');
      return data;
    }

    // Manual punch-out — use server-side RPC
    const { data, error } = await supabase.rpc('attendance_punch_out_v3', {
      p_record_id: recordId,
      p_lunch_duration_ms: lunchDurationMs || 0,
    });

    if (error) throw error;
    console.log(`[Attendance] Punched out via heartbeat-validated RPC v3. Status: ${data?.status}`);
    return data;
  },

  /**
   * Start Lunch Break — marks the start of a lunch break.
   */
  async startLunchBreak(recordId) {
    validateDevice();
    const now = new Date().toISOString();
    const { data, error } = await supabase.rpc('attendance_start_lunch_break', {
      p_record_id: recordId,
    });

    if (error) throw error;

    // Manually ensure lunch_start_time is recorded for tooltip/history
    await supabase.from('attendance').update({ 
      lunch_start_time: now,
      lunch_end_time: null 
    }).eq('id', recordId);

    console.log('[Attendance] Started lunch break and preserved start time');
    return data;
  },

  /**
   * End Lunch Break — calculates duration and updates record.
   */
  async endLunchBreak(recordId, lunchStartTime, currentDurationMs = 0, delayReason = null) {
    validateDevice();
    const now = new Date().toISOString();
    const { data, error } = await supabase.rpc('attendance_end_lunch_break', {
      p_record_id: recordId,
      p_current_duration_ms: currentDurationMs || 0,
      p_delay_reason: delayReason,
    });

    if (error) throw error;

    // Manually restore lunch_start_time and set lunch_end_time
    await supabase.from('attendance').update({
      lunch_start_time: lunchStartTime,
      lunch_end_time: now
    }).eq('id', recordId);

    console.log('[Attendance] Ended lunch break and preserved timestamps');
    return data;
  },

  /**
   * Start Overtime — marks the start of overtime.
   */
  async startOvertime(recordId) {
    validateDevice();
    const { data, error } = await supabase.rpc('attendance_start_overtime_v2', {
      p_record_id: recordId
    });

    if (error) throw error;
    console.log('[Attendance] Started overtime using secure RPC');
    return data;
  },

  /**
   * End Overtime — calculates duration and updates record.
   */
  async endOvertime(recordId, overtimeStartTime) {
    validateDevice();
    const { data, error } = await supabase.rpc('attendance_end_overtime_v2', {
      p_record_id: recordId
    });

    if (error) throw error;
    console.log('[Attendance] Ended overtime using secure RPC');
    return data;
  },

  /**
   * Get attendance history for the employee with optional filtering.
   */
  async getAttendanceHistory(userId, { limit = 10, days = null, startDate = null } = {}) {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('attendance_date', { ascending: false });

    if (startDate) {
      query = query.gte('attendance_date', startDate);
    } else if (days) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const minDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      query = query.gte('attendance_date', minDate);
    }

    if (limit && !startDate && !days) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async submitAbsenceReason(attendanceId, userId, reason) {
    const { data, error } = await supabase
      .from('attendance_explanations')
      .upsert(
        {
          attendance_id: attendanceId,
          user_id: userId,
          reason,
          status: 'pending',
          reviewer_note: null,
          reviewed_by: null,
          reviewed_at: null,
        },
        { onConflict: 'attendance_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPendingAbsenceExplanations({ startDate = null, endDate = null } = {}) {
    const query = supabase
      .from('attendance_explanations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async reviewAbsenceExplanation(explanationId, status, reviewerNote = null) {
    const payload = {
      status,
      reviewer_note: reviewerNote,
      reviewed_at: new Date().toISOString(),
    };
    const { data: reviewer } = await supabase.auth.getUser();
    if (reviewer?.user?.id) payload.reviewed_by = reviewer.user.id;

    const { data, error } = await supabase
      .from('attendance_explanations')
      .update(payload)
      .eq('id', explanationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * [HR/ADMIN] Get today's attendance statistics using IST date.
   */
  async getTodayStats(date = null) {
    const today = date || await getTodayIST();

    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('attendance_date', today);

    if (error) throw error;

    return {
      present: data.filter(r => ['punched_in', 'punched_out', 'auto_punched_out'].includes(r.status)).length,
      punchedIn: data.filter(r => r.status === 'punched_in').length,
      punchedOut: data.filter(r => r.status === 'punched_out' || r.status === 'auto_punched_out').length,
    };
  },

  /**
   * [HR/ADMIN] Get attendance counts for the last 7 days.
   */
  async getAttendanceTrends() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    }

    const [attRes, profRes] = await Promise.all([
      supabase.from('attendance').select('attendance_date, status').in('attendance_date', dates),
      supabase.from('profiles').select('id', { count: 'exact', head: true })
    ]);

    if (attRes.error) throw attRes.error;
    if (profRes.error) throw profRes.error;

    const totalEmployees = profRes.count || 1;

    return dates.map(date => {
      const dayData = attRes.data.filter(r => r.attendance_date === date);
      const presentCount = dayData.filter(r => ['punched_in', 'punched_out', 'auto_punched_out'].includes(r.status)).length;
      const percentage = Math.round((presentCount / totalEmployees) * 100);

      return {
        date,
        label: new Date(date).toLocaleDateString([], { weekday: 'short' }),
        value: percentage
      };
    });
  },

  /**
   * [HR/ADMIN] Get formatted list of attendance with filters
   */
  async getAttendanceOverview({ date = null, startDate = null, endDate = null, dept = 'all', empId = '' } = {}) {
    // 1. Build Query
    let query = supabase
      .from('attendance')
      .select(`
        *,
        profiles!attendance_profiles_user_id_fkey (
          id,
          full_name,
          email,
          designation,
          employee_id,
          departments!profiles_department_id_fkey (name)
        ),
        attendance_explanations:attendance_explanations!attendance_id (
          id,
          reason,
          status,
          reviewer_note,
          reviewed_at
        )
      `);

    // Date Filtering
    if (startDate && endDate) {
      query = query.gte('attendance_date', startDate).lte('attendance_date', endDate);
    } else {
      const targetDate = date || await getTodayIST();
      query = query.eq('attendance_date', targetDate);
    }

    // Sort by date and then name
    query = query.order('attendance_date', { ascending: false });

    // 2. Execute Query
    const { data: att, error: attErr } = await query;

    if (attErr) {
      console.error('[Attendance] Overview fetch error:', attErr.message);
      throw attErr;
    }

    if (!att || att.length === 0) return [];

    // 3. Post-fetch filtering (Supabase doesn't easily filter on joined tables in one go without complex RPC)
    let filtered = att;

    if (dept !== 'all') {
      filtered = filtered.filter(item => item.profiles?.departments?.name === dept);
    }

    if (empId) {
      const search = empId.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.profiles?.employee_id?.toLowerCase().includes(search) ||
        item.profiles?.full_name?.toLowerCase().includes(search)
      );
    }

    // 4. Format for DataTable
    return filtered.map(item => {
      const p = item.profiles || {};
      const lunchMin = item.lunch_duration_ms ? Math.round(item.lunch_duration_ms / 60000) : 0;
      return {
        id: item.id,
        date: item.attendance_date,
        rawStatus: item.status,
        name: p.full_name || p.email || 'Unknown',
        email: p.email || '-',
        empId: p.employee_id || '-',
        dept: p.departments?.name || p.designation || 'Staff',
        punchIn: item.punch_in_time ? new Date(item.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        punchOut: item.punch_out_time ? new Date(item.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        status:
          item.status === 'punched_in' ? 'Present'
            : (item.status === 'punched_out' || item.status === 'auto_punched_out') ? 'Left'
              : item.status === 'on_leave' ? 'On Leave'
                : item.status === 'absent_unjustified' ? 'Absent !'
                  : item.status === 'absent_explanation_pending' ? 'Reason Pending'
                    : item.status === 'absent_explained' ? 'Absent Explained'
                      : 'Absent',
        absenceExplanation: item.attendance_explanations?.[0] || null,
        lunchDuration: lunchMin,
        lunchStart: item.lunch_start_time ? new Date(item.lunch_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        lunchEnd: item.lunch_end_time ? new Date(item.lunch_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        totalHours: item.total_hours || 0,
        overtime: item.overtime_duration_ms ? parseFloat((item.overtime_duration_ms / 3600000).toFixed(2)) : 0,
        punch_in_time: item.punch_in_time,
        punch_out_time: item.punch_out_time,
        lunch_start_time: item.lunch_start_time,
        lunch_end_time: item.lunch_end_time,
        lunch_duration_ms: item.lunch_duration_ms
      };
    });
  },

  /**
   * [EMPLOYEE] Get performance stats for the current month.
   */
  async getEmployeeStats(userId) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('attendance')
      .select('total_hours, attendance_date, status')
      .eq('user_id', userId)
      .gte('attendance_date', startDate);

    if (error) throw error;

    // Calculate Attendance Rate
    // Formula: (Days Present / Total Days Passed in Month) * 100
    const daysPassed = today.getDate();
    const presentDays = data.filter(r => ['punched_in', 'punched_out', 'auto_punched_out'].includes(r.status)).length;
    const attendanceRate = daysPassed > 0 ? Math.round((presentDays / daysPassed) * 100) : 0;

    // Calculate Avg Working Hours (only for days worked)
    const workedDays = data.filter(r => r.total_hours > 0);
    const totalHours = workedDays.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const avgHours = workedDays.length > 0 ? (totalHours / workedDays.length).toFixed(1) : '0';

    return {
      attendanceRate,
      avgHours,
      presentDays
    };
  },

  async checkIpValidity() {
    const { data, error } = await supabase.rpc('check_ip_validity');
    if (error) throw error;
    return data;
  },

  /**
   * Fetch the current heartbeat status from office_ip_heartbeat.
   * Returns the latest record including IP, freshness, and heartbeat count.
   */
  async getHeartbeatStatus() {
    const { data, error } = await supabase
      .from('office_ip_heartbeat')
      .select('*')
      .eq('is_active', true)
      .order('last_heartbeat_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch recent IP change log entries (admin/HR only).
   */
  async getIpChangeLogs(limit = 30) {
    const { data, error } = await supabase
      .from('ip_change_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
};
