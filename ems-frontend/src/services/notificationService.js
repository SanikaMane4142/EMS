import { supabase } from '../lib/supabaseClient';

export const notificationService = {
  /**
   * Get all notifications for a user
   */
  async getMyNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(id) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Send a notification to all HR and Admins
   */
  async notifyAdmins(title, message, type = 'info', link = null) {
    console.log('notifyAdmins: starting...', { title, message, link });
    // 1. Get all HR/Admin profile IDs
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['hr', 'admin', 'super_admin']);

    if (adminError) {
      console.error('notifyAdmins: Error fetching admins:', adminError);
      throw adminError;
    }
    
    console.log(`notifyAdmins: Found ${admins?.length || 0} admins`, admins);
    if (!admins || admins.length === 0) return;

    // 2. Create notification records for each admin
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message,
      type,
      link
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.error('notifyAdmins: Error inserting notifications:', notifError);
      throw notifError;
    }
    console.log('notifyAdmins: Notifications sent successfully');
  },

  /**
   * Send a notification to a specific user
   */
  async notifyUser(userId, title, message, type = 'info', link = null) {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link
      });

    if (error) {
      console.error('notifyUser: Error sending notification:', error);
      throw error;
    }
  }
};
