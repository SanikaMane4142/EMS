import { supabase } from '../lib/supabaseClient';
import { notificationService } from './notificationService';

/**
 * LEAVE SERVICE
 * Manages leave applications and HR approvals
 */
export const leaveService = {
  /**
   * Submit a new leave request
   */
  async applyLeave(userId, leaveData) {
    // 1. Calculate total days with sandwich logic (Monday is holiday)
    const { totalDays, isSandwich } = await this.calculateLeaveDays(leaveData.start_date, leaveData.end_date);

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: userId,
        leave_type: leaveData.leave_type,
        start_date: leaveData.start_date,
        end_date: leaveData.end_date,
        total_days: totalDays,
        is_sandwich_applied: isSandwich,
        reason: leaveData.reason,
        medical_doc_url: leaveData.medical_doc_url || null,
        is_lwp: leaveData.leave_type === 'lwp'
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to HR/Admins
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const name = profile?.full_name || 'An employee';
      await notificationService.notifyAdmins(
        'New Leave Request',
        `${name} has applied for ${leaveData.leave_type} (${totalDays} days) starting ${leaveData.start_date}.`,
        'warning',
        '/leave'
      );
    } catch (notifErr) {
      console.warn('Notification failed but leave was applied:', notifErr.message);
    }

    return data;
  },

  /**
   * Fetch leave history for the logged-in user
   */
  async getMyLeaves(userId) {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * [HR ONLY] Fetch all pending requests
   */
  /**
   * Fetch all requests with applicant and approver info
   */
  async getAllRequests() {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        profiles:profiles!user_id(id, full_name, email, department_id, departments!profiles_department_id_fkey(name)),
        hr:profiles!hr_id(id, full_name),
        super_admin:profiles!super_admin_id(id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * [HR ONLY] Approve or Reject a request
   */
  /**
   * Update status based on role and current stage
   */
  async updateStatus(requestId, status, userId, role) {
    let updateData = {};
    
    if (status === 'rejected') {
      updateData = { 
        status: 'rejected',
        hr_id: role === 'hr' || role === 'admin' ? userId : undefined,
        super_admin_id: role === 'super_admin' ? userId : undefined,
        updated_at: new Date().toISOString()
      };
    } else if (status === 'approved') {
      if (role === 'hr' || role === 'admin') {
        updateData = { 
          status: 'pending_super_admin',
          hr_id: userId,
          hr_action_at: new Date().toISOString()
        };
      } else if (role === 'super_admin') {
        // FINAL APPROVAL: Deduct balance
        const { data: request } = await supabase.from('leave_requests').select('*').eq('id', requestId).single();
        if (request && !request.is_lwp) {
          await this.deductBalance(request.user_id, request.leave_type, request.total_days);
        }

        updateData = { 
          status: 'approved',
          super_admin_id: userId,
          super_admin_action_at: new Date().toISOString()
        };
      }
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update(updateData)
      .eq('id', requestId)
      .select('*, profiles!user_id(full_name)')
      .maybeSingle();

    if (error) throw error;

    // Send notifications based on the new status
    try {
      const applicantId = data.user_id;
      const applicantName = data.profiles?.full_name || 'An employee';

      if (data.status === 'pending_super_admin') {
        // Notify Super Admins
        await notificationService.notifyAdmins(
          'Final Leave Approval Required',
          `HR has approved ${applicantName}'s request. Super Admin action required.`,
          'info',
          '/leave'
        );
      } else if (data.status === 'approved') {
        // Notify Employee
        await supabase.from('notifications').insert({
          user_id: applicantId,
          title: 'Leave Approved!',
          message: 'Your leave request has been finalized and approved.',
          type: 'success',
          link: '/my-leaves'
        });
      } else if (data.status === 'rejected') {
        // Notify Employee
        await supabase.from('notifications').insert({
          user_id: applicantId,
          title: 'Leave Rejected',
          message: 'Your leave request has been rejected. Check the management portal for details.',
          type: 'error',
          link: '/my-leaves'
        });
      }
    } catch (notifErr) {
      console.warn('Post-update notification failed:', notifErr.message);
    }

    return data;
  },

  async getLeaveSummary() {
    const { data, error } = await supabase.from('leave_requests').select('status');
    if (error) throw error;
    return {
      pending: data.filter(r => r.status.startsWith('pending')).length,
      approved: data.filter(r => r.status === 'approved').length,
      rejected: data.filter(r => r.status === 'rejected').length
    };
  },

  /**
   * Fetch current year balances for a user
   */
  async getLeaveBalances(userId) {
    const year = new Date().getFullYear();
    let { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .maybeSingle();

    if (error) throw error;

    // If no balance exists for this year, initialize it
    if (!data) {
      data = await this.initializeLeaveBalances(userId, year);
    }

    return data;
  },

  /**
   * Seed initial balances for a user
   */
  async initializeLeaveBalances(userId, year) {
    const { data, error } = await supabase
      .from('leave_balances')
      .upsert(
        { user_id: userId, year },
        { onConflict: 'user_id, year' }
      )
      .select()
      .single();
    
    if (error) {
      console.error('Initialization error:', error);
      throw error;
    }
    return data;
  },

  /**
   * Deduct used days from balance
   */
  async deductBalance(userId, leaveType, days) {
    const year = new Date().getFullYear();
    const balanceFieldMap = {
      'casual_leave': 'cl_used',
      'Casual Leave': 'cl_used',
      'sick_leave': 'sl_used',
      'Sick Leave': 'sl_used',
      'Medical/Sick Leave (ML/SL)': 'sl_used',
      'optional_leave': 'ol_used',
      'Optional Leave': 'ol_used'
    };

    const field = balanceFieldMap[leaveType] || balanceFieldMap[leaveType.trim()];
    if (!field) {
      console.warn(`No balance field mapping for: ${leaveType}`);
      return;
    }

    // Using RPC or simple update for now (RPC is safer for atomic increments)
    const { data: current } = await supabase
      .from('leave_balances')
      .select(field)
      .eq('user_id', userId)
      .eq('year', year)
      .single();
    
    const newVal = (current?.[field] || 0) + days;

    const { error } = await supabase
      .from('leave_balances')
      .update({ [field]: newVal, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('year', year);
    
    if (error) throw error;
  },

  /**
   * Manually set leave balances for a specific user
   */
  async updateCustomBalances(userId, balances) {
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from('leave_balances')
      .upsert(
        { 
          user_id: userId, 
          year, 
          cl_total: balances.cl_total, 
          sl_total: balances.sl_total, 
          ol_total: balances.ol_total,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id, year' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Calculate duration with Sandwich Logic (Monday is weekly off)
   */
  async calculateLeaveDays(startDate, endDate) {
    if (!startDate || !endDate) return { totalDays: 0, isSandwich: false };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Normalize dates to midnight to avoid timezone issues
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // 1. Fetch Company Holidays
    const { data: holidays } = await supabase.from('company_holidays').select('holiday_date');
    const holidayDates = (holidays || []).map(h => h.holiday_date);

    let totalDays = 0;
    let hasHolidayOrMonday = false;

    // Create a working copy for the loop
    let current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ...

      totalDays++;
      
      // If it's a Monday (1) or a Company Holiday, flag it
      if (dayOfWeek === 1 || holidayDates.includes(dateStr)) {
        hasHolidayOrMonday = true;
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return { totalDays, isSandwich: hasHolidayOrMonday };
  },

  /**
   * Upload medical certificate to Supabase Storage
   */
  async uploadMedicalCert(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('medical-certificates')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('medical-certificates')
      .getPublicUrl(filePath);

    return publicUrl;
  }
};

