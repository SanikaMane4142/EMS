import { supabase } from '../lib/supabaseClient';

/**
 * PROFILE SERVICE
 * Handles user profiles, employee lists, and department memberships.
 * NOTE: profiles.department_id has a FK to public.departments.id
 * Use the alias syntax: departments(id, name) — works when there is only one FK path.
 * Do NOT use FK hint strings (e.g. profiles!profiles_department_id_fkey) — constraint
 * name may vary based on migration order.
 */
export const profileService = {

  /**
   * Get current user's full profile including department name
   */
  async getCurrentProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments!profiles_department_id_fkey(id, name)')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get a specific user's profile by ID
   */
  async getProfileById(id) {
    if (!id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments!profiles_department_id_fkey(id, name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a user's profile
   */
  async updateProfile(id, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get all employees with their department info
   */
  async getAllEmployees() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments!profiles_department_id_fkey(id, name)')
      .order('full_name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get members of a specific department
   */
  async getDepartmentMembers(departmentId) {
    if (!departmentId) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, designation, avatar_url, role')
      .eq('department_id', departmentId)
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get upcoming birthdays (within same or next month)
   */
  async getUpcomingBirthdays() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, birthday, designation, departments!profiles_department_id_fkey(name)')
        .not('birthday', 'is', null)
        .order('birthday');

      if (error) {
        console.warn('[profileService] getUpcomingBirthdays failed:', error.message);
        return [];
      }

      const now = new Date();
      return (data || []).filter(p => {
        const bday = new Date(p.birthday);
        return (
          bday.getMonth() === now.getMonth() ||
          bday.getMonth() === (now.getMonth() + 1) % 12
        );
      }).slice(0, 5);
    } catch (err) {
      console.warn('[profileService] getUpcomingBirthdays unexpected error:', err.message);
      return [];
    }
  },

  /**
   * Get recently joined employees.
   * Falls back to created_at if joined_at column does not exist.
   */
  async getRecentJoiners(limit = 5) {
    try {
      // Try with joined_at first
      let { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, designation, joined_at, created_at, departments!profiles_department_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error && error.code === '42703') {
        // Column joined_at doesn't exist, retry without it
        console.warn('joined_at missing, falling back to created_at');
        const { data: fallback, error: fallErr } = await supabase
          .from('profiles')
          .select('id, full_name, email, designation, created_at, departments!profiles_department_id_fkey(name)')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (fallErr) throw fallErr;
        return (fallback || []).map(p => ({ ...p, joined_at: p.created_at }));
      }

      if (error) throw error;
      return (data || []).map(p => ({ ...p, joined_at: p.joined_at || p.created_at }));
    } catch (err) {
      console.error('getRecentJoiners error:', err);
      return [];
    }
  },
};
