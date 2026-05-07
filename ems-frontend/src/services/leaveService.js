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
    const { data, error } = await supabase
      .from('leave_requests')
      .insert([
        {
          user_id: userId,
          leave_type: leaveData.leave_type,
          start_date: leaveData.start_date,
          end_date: leaveData.end_date,
          reason: leaveData.reason,
          status: 'pending_hr'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Send notification to HR/Admins
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const name = profile?.full_name || 'An employee';
      await notificationService.notifyAdmins(
        'New Leave Request',
        `${name} has applied for ${leaveData.leave_type} starting ${leaveData.start_date}.`,
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
  }
};

