import { supabase } from '../lib/supabaseClient';

export const employeeService = {
  /**
   * Fetch all employees with department details
   */
  async getAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        departments!profiles_department_id_fkey (name)
      `)
      .order('full_name');

    if (error) throw error;
    return data;
  },

  /**
   * Delete an employee profile
   */
  async delete(id) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Get stats for Admin Dashboard
   */
  async getAdminStats() {
    // We execute these in parallel for speed
    const [empCount, activeCount, deptCount] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('departments').select('*', { count: 'exact', head: true })
    ]);

    return {
      totalEmployees: empCount.count || 0,
      activeEmployees: activeCount.count || 0,
      totalDepartments: deptCount.count || 0
    };
  },

  /**
   * Fetch employees having birthdays or work anniversaries today
   */
  async getTodayCelebrations() {
    const today = new Date();
    const month = today.getMonth() + 1; // JS months are 0-indexed
    const day = today.getDate();

    // Use RPC or raw query for date extraction if possible, 
    // but for now we fetch and filter to ensure compatibility.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, birthday, joining_date, designation')
      .eq('status', 'active');

    if (error) throw error;

    return (data || []).filter(profile => {
      const bday = profile.birthday ? new Date(profile.birthday) : null;
      const jday = profile.joining_date ? new Date(profile.joining_date) : null;

      const isBirthday = bday && (bday.getMonth() + 1 === month && bday.getDate() === day);
      const isAnniversary = jday && (jday.getMonth() + 1 === month && jday.getDate() === day);

      if (isBirthday || isAnniversary) {
        profile.type = isBirthday ? 'birthday' : 'anniversary';
        if (isAnniversary) {
          profile.years = today.getFullYear() - jday.getFullYear();
        }
        return true;
      }
      return false;
    });
  }
};
