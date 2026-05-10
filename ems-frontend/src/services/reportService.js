import { supabase } from '../lib/supabaseClient';
import { notificationService } from './notificationService';

/**
 * Returns today's date string in YYYY-MM-DD format using Asia/Kolkata (IST) timezone.
 */
const getTodayIST = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * REPORT SERVICE
 * Handles daily work reports and performance tracking
 */
export const reportService = {
  /**
   * Submit a daily work report (Structured)
   */
  async submitDailyReport(userId, reportData) {
    const today = getTodayIST();

    const { data, error } = await supabase
      .from('daily_reports')
      .upsert({
        user_id: userId,
        report_date: today,
        tasks_planned: reportData.tasks_planned,
        tasks_completed: reportData.tasks_completed,
        work_in_progress: reportData.work_in_progress,
        tomorrow_plan: reportData.tomorrow_plan,
        total_working_hours: reportData.total_working_hours,
        productivity_rating: reportData.productivity_rating,
        additional_notes: reportData.additional_notes,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, report_date' })
      .select()
      .single();

    if (error) throw error;

    // Send notification to HR/Admins
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const name = profile?.full_name || 'An employee';
      await notificationService.notifyAdmins(
        'New Work Report',
        `${name} has submitted their daily work report for ${today}.`,
        'info',
        '/reports'
      );
    } catch (notifErr) {
      console.warn('Notification failed but report was submitted:', notifErr.message);
    }

    return data;
  },

  /**
   * Get today's report for a user
   */
  async getTodayReport(userId) {
    const today = getTodayIST();

    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('report_date', today)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * [HR/ADMIN] Get all reports across the system
   */
  async getAllReports(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          profiles!user_id (
            full_name,
            email,
            departments!profiles_department_id_fkey (name)
          )
        `)
        .order('report_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error && error.message.includes('relationship')) {
        const { data: fallback, error: fallErr } = await supabase
          .from('daily_reports')
          .select(`
            *,
            profiles (
              full_name,
              email,
              departments!profiles_department_id_fkey (name)
            )
          `)
          .order('report_date', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(limit);
        
        if (fallErr) throw fallErr;
        return fallback || [];
      }

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getAllReports error:', err);
      return [];
    }
  },

  /**
   * [HR/ADMIN] Get reports for a specific date
   */
  async getReportsByDate(date) {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          profiles!user_id (
            full_name,
            email,
            departments!profiles_department_id_fkey (name)
          )
        `)
        .eq('report_date', date)
        .order('updated_at', { ascending: false });

      if (error && error.message.includes('relationship')) {
        const { data: fallback, error: fallErr } = await supabase
          .from('daily_reports')
          .select(`
            *,
            profiles (
              full_name,
              email,
              departments!profiles_department_id_fkey (name)
            )
          `)
          .eq('report_date', date)
          .order('updated_at', { ascending: false });
        
        if (fallErr) throw fallErr;
        return fallback || [];
      }

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getReportsByDate error:', err);
      return [];
    }
  },

  /**
   * Get all reports for a user (history)
   */
  async getReportHistory(userId, limit = 30) {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * [HR/ADMIN] Get all reports for today
   */
  async getTodayReports() {
    const today = getTodayIST();

    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          profiles!user_id (
            full_name,
            email,
            departments!profiles_department_id_fkey (name)
          )
        `)
        .eq('report_date', today)
        .order('updated_at', { ascending: false });

      if (error && error.message.includes('relationship')) {
        const { data: fallback, error: fallErr } = await supabase
          .from('daily_reports')
          .select(`
            *,
            profiles (
              full_name,
              email,
              departments!profiles_department_id_fkey (name)
            )
          `)
          .eq('report_date', today)
          .order('updated_at', { ascending: false });
        
        if (fallErr) throw fallErr;
        return fallback || [];
      }

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getTodayReports error:', err);
      return [];
    }
  },

  /**
   * [HR/ADMIN] Mark a report as reviewed and notify the employee
   */
  async reviewReport(reportId, employeeId, reviewerId) {
    // 1. Update report status
    const { data: reports, error: reportErr } = await supabase
      .from('daily_reports')
      .update({
        status: 'reviewed',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select();

    if (reportErr) throw reportErr;
    
    if (!reports || reports.length === 0) {
      throw new Error('Report not found or you do not have permission to review it.');
    }

    const report = reports[0];

    // 2. Create notification for the employee
    const { error: notifyErr } = await supabase
      .from('notifications')
      .insert([{
        user_id: employeeId,
        title: 'Report Reviewed',
        message: `Your work report for ${new Date(report.report_date).toLocaleDateString()} has been reviewed by HR.`,
        type: 'success'
      }]);

    if (notifyErr) console.error('Failed to create notification:', notifyErr.message);

    return report;
  },

  /**
   * Get stats for dashboard
   */
  async getReportStats() {
    const { count, error } = await supabase
      .from('daily_reports')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  }
};
