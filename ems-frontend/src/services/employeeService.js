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
  }
};
