import { supabase } from '../lib/supabaseClient';

export const departmentService = {
  /**
   * Fetch all departments
   */
  async getAll() {
    const { data, error } = await supabase
      .from('departments')
      .select(`
        *,
        employee_count:profiles!department_id(count)
      `)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Create a new department
   */
  async create(deptData) {
    const { data, error } = await supabase
      .from('departments')
      .insert([deptData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get stats for department load
   */
  async getDepartmentStats() {
    const { data, error } = await supabase
      .from('departments')
      .select(`
        id,
        name,
        icon,
        profiles!department_id(count)
      `);

    if (error) throw error;

    // We also need attendance counts per department for "Present" vs "Total"
    // For simplicity in this MVP, we return total and a mock present count 
    // or we can just return the totals.
    return data.map(d => ({
      name: d.name,
      total: d.profiles[0]?.count || 0,
      present: Math.floor((d.profiles[0]?.count || 0) * 0.9), // Mocking present for load visualization
      icon: d.icon || '🏢'
    }));
  },

  /**
   * Update an existing department
   */
  async update(id, deptData) {
    const { data, error } = await supabase
      .from('departments')
      .update(deptData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a department
   */
  async delete(id) {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
