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
   * Update a user's profile.
   * Includes a fallback to handle missing columns (like 'birthday') gracefully.
   */
  async updateProfile(id, profileData) {
    // Clean up data: convert empty strings to null for date fields
    const cleanedData = { ...profileData };
    if (cleanedData.joining_date === '') cleanedData.joining_date = null;
    if (cleanedData.joined_at === '') cleanedData.joined_at = null;
    if (cleanedData.birthday === '') cleanedData.birthday = null;

    const { data, error } = await supabase
      .from('profiles')
      .update(cleanedData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[profileService] updateProfile failed:', error);
      
      // If it's a "column does not exist" error (42703), provide a helpful message
      if (error.code === '42703') {
        throw new Error(`Database schema mismatch: ${error.message}. Please ensure joining_date and joined_at columns exist.`);
      }
      
      throw error;
    }

    if (!data) {
      throw new Error('No profile found to update or permission denied.');
    }

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
        .eq('status', 'active');

      if (error) {
        console.warn('[profileService] getUpcomingBirthdays failed:', error.message);
        return [];
      }

      const now = new Date();
      const todayMonth = now.getMonth(); // 0-11
      const todayDay = now.getDate(); // 1-31
      
      // Rule: If today is after the 15th, extend visibility to the 15th of next month
      const isEndOfMonth = todayDay > 15;

      return (data || [])
        .map(p => {
          // Timezone-safe parsing: YYYY-MM-DD
          const parts = p.birthday.split('-');
          return { 
            ...p, 
            bMonth: parseInt(parts[1], 10) - 1, // Convert 1-12 to 0-11
            bDay: parseInt(parts[2], 10) 
          };
        })
        .filter(p => {
          // Rule 1: Show birthdays starting from today's date in current month
          if (p.bMonth === todayMonth) {
            return p.bDay >= todayDay;
          }
          
          // Rule 2: If near end of month, include up to 15th of next month
          if (isEndOfMonth) {
            const nextMonth = (todayMonth + 1) % 12;
            if (p.bMonth === nextMonth) {
              return p.bDay <= 15;
            }
          }
          
          return false;
        })
        .sort((a, b) => {
          // Sort chronologically by nearest upcoming date (ignoring year)
          // Handle year wrap-around (e.g., Dec to Jan)
          let m_a = a.bMonth;
          let m_b = b.bMonth;
          
          if (m_a < todayMonth) m_a += 12;
          if (m_b < todayMonth) m_b += 12;
          
          if (m_a !== m_b) return m_a - m_b;
          return a.bDay - b.bDay;
        })
        .slice(0, 8); // Keep the list clean and short
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
        .select('id, full_name, email, designation, joined_at, joining_date, created_at, departments!profiles_department_id_fkey(name)')
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
