import { supabase } from '../lib/supabaseClient';

/**
 * Returns today's date string in YYYY-MM-DD format using Asia/Kolkata (IST) timezone.
 * This is the SINGLE source of truth for "today" across the entire attendance system.
 */
const getTodayIST = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

export const attendanceService = {

  /**
   * Fetch today's attendance record from Supabase.
   * Priority:
   *   1. Any record with status='punched_in' (active shift — recovers after logout)
   *   2. Any record for today's date (covers punched_out / auto_punched_out)
   */
  async getActiveRecord(userId) {
    const today = getTodayIST();

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
    const now = new Date();
    const today = getTodayIST();

    const { data, error } = await supabase
      .from('attendance')
      .upsert(
        {
          user_id: userId,
          attendance_date: today,
          punch_in_time: now.toISOString(),
          punch_out_time: null,
          total_hours: null,
          status: 'punched_in',
        },
        { onConflict: 'user_id,attendance_date' }
      )
      .select()
      .single();

    if (error) throw error;
    console.log('[Attendance] Punched in at', now.toISOString());
    return data;
  },

  /**
   * Punch Out — updates the record and calculates total hours.
   */
  async punchOut(recordId, punchInTime) {
    const punchOutTime = new Date();
    const diffMs = punchOutTime - new Date(punchInTime);
    const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const { data, error } = await supabase
      .from('attendance')
      .update({
        punch_out_time: punchOutTime.toISOString(),
        total_hours: totalHours,
        status: 'punched_out',
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    console.log('[Attendance] Punched out. Total hours:', totalHours);
    return data;
  },

  /**
   * Auto Punch Out — for overnight/missed punch-outs.
   */
  async autoPunchOut(recordId, punchInTime) {
    const autoOutTime = new Date(new Date(punchInTime).getTime() + 8 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('attendance')
      .update({
        punch_out_time: autoOutTime.toISOString(),
        total_hours: 8.0,
        status: 'auto_punched_out',
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get recent attendance history for the employee.
   */
  async getAttendanceHistory(userId, limit = 10) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('attendance_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * [HR/ADMIN] Get today's attendance statistics using IST date.
   */
  async getTodayStats() {
    const today = getTodayIST();

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
   * [HR/ADMIN] Get formatted list of today's attendance with profiles
   */
  async getAttendanceOverview() {
    const today = getTodayIST();

    // 1. Get attendance records
    const { data: att, error: attErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', today);

    if (attErr) throw attErr;
    if (!att || att.length === 0) return [];

    // 2. Get profiles for these users
    const userIds = att.map(r => r.user_id);
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, designation')
      .in('id', userIds);

    if (profErr) {
      console.warn('Could not fetch profiles for attendance overview:', profErr.message);
      return att.map(r => ({ ...r, name: 'Unknown', email: '-', dept: 'Staff' }));
    }

    const profileMap = {};
    profiles.forEach(p => { profileMap[p.id] = p; });

    // 3. Merge and Format
    return att.map(item => {
      const p = profileMap[item.user_id] || {};
      return {
        id: item.id,
        name: p.full_name || p.email || 'Unknown',
        email: p.email || '-',
        dept: p.designation || 'Staff',
        punchIn: item.punch_in_time ? new Date(item.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        punchOut: item.punch_out_time ? new Date(item.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        status: item.status === 'punched_in' ? 'Present' : (item.status === 'punched_out' ? 'Left' : 'Absent')
      };
    });
  }
};
