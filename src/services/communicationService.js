import { supabase } from '../lib/supabaseClient';

/**
 * COMMUNICATION SERVICE
 * Handles organization-wide announcements
 */
export const communicationService = {
  /**
   * Fetch latest active announcements
   * @param {number} limit - Number of records to fetch
   */
  async getLatestAnnouncements(limit = 5) {
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        author:profiles!created_by (full_name)
      `)
      .eq('is_active', true)
      .neq('is_deleted', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[communicationService] Error fetching announcements:', error.message);
      throw error;
    }
    return data || [];
  },

  /**
   * Fetch all announcements (Admin view, includes archived)
   */
  async getAllAnnouncements() {
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        author:profiles!created_by (full_name)
      `)
      .neq('is_deleted', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[communicationService] Error fetching all announcements:', error.message);
      throw error;
    }
    return data || [];
  },

  /**
   * Create a new announcement (HR/Admin only)
   */
  async postAnnouncement(payload) {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: payload.title,
        content: payload.content,
        priority: payload.priority || 'info',
        created_by: payload.userId,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[communicationService] Error posting announcement:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Toggle announcement status (archive/delete)
   */
  async toggleStatus(id, isActive) {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Hide from Admin (stays in database)
   */
  async deleteNotice(id) {
    const { error } = await supabase
      .from('announcements')
      .update({ is_deleted: true, is_active: false })
      .eq('id', id);

    if (error) throw error;
  }
};
