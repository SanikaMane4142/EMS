import { supabase } from '../lib/supabaseClient';

/**
 * Select fragment used in all task queries.
 * Pulls nested groups → subtasks and both profile FKs.
 */
const TASK_SELECT = `
  *,
  task_groups ( 
    id, title, is_completed, sort_order, updated_at, 
    subtasks ( id, title, is_completed, due_date, sort_order, updated_at ) 
  ),
  assignee:profiles!assigned_to ( 
    id, full_name, employee_id, department_id, 
    departments!profiles_department_id_fkey ( name ) 
  ),
  assigner:profiles!assigned_by ( id, full_name )
`;

export const taskService = {
  // ─────────────────────────────────────────────
  // READS
  // ─────────────────────────────────────────────

  /**
   * Tasks visible to the current employee:
   *  - tasks they were assigned
   *  - tasks they created (assigned_by) — needed so assigner can mark reviewed
   */
  async getMyTasks(userId) {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .or(`assigned_to.eq.${userId},assigned_by.eq.${userId}`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** HR / Admin: every task in the org */
  async getAllTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[taskService] Error in getAllTasks:', error);
      throw error;
    }
    console.log('[taskService] getAllTasks raw data:', data);
    return data || [];
  },

  async getTaskById(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', taskId)
      .single();
    if (error) throw error;
    return data;
  },

  async getSubtaskGroups(taskId) {
    // 1. Fetch groups for this task
    const { data: groups, error: groupsError } = await supabase
      .from('task_groups')
      .select('*')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });
    
    if (!groups || groups.length === 0) {
      console.log('[taskService] Direct group fetch returned no data, attempting fallback through tasks table...');
      // Fallback: Fetch groups by joining through the tasks table (which HR has broader access to)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('tasks')
        .select('task_groups(*)')
        .eq('id', taskId)
        .single();
      
      if (fallbackError) {
        console.error('[taskService] Fallback fetch failed:', fallbackError);
        return [];
      }
      
      const fallbackGroups = fallbackData?.task_groups || [];
      if (fallbackGroups.length === 0) return [];
      
      // If we found groups via fallback, fetch their subtasks too
      const groupIds = fallbackGroups.map(g => g.id);
      const { data: subtasks } = await supabase
        .from('subtasks')
        .select('*')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true });
        
      return fallbackGroups.map(g => ({
        ...g,
        subtasks: subtasks?.filter(s => s.group_id === g.id) || []
      }));
    }

    // 2. Fetch all subtasks for these groups
    const groupIds = groups.map(g => g.id);
    const { data: subtasks, error: subtasksError } = await supabase
      .from('subtasks')
      .select('*')
      .in('group_id', groupIds)
      .order('sort_order', { ascending: true });

    if (subtasksError) {
      console.error('[taskService] Error fetching subtasks:', subtasksError);
      // We still return groups even if subtasks fail
      return groups.map(g => ({ ...g, subtasks: [] }));
    }

    // 3. Merge subtasks into their respective groups
    return groups.map(g => ({
      ...g,
      subtasks: subtasks.filter(s => s.group_id === g.id)
    }));
  },

  /** Activity log for a single task (HR view) */
  async getActivityLog(taskId) {
    const { data, error } = await supabase
      .from('task_activity_logs')
      .select('*, actor:profiles!actor_id(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // ─────────────────────────────────────────────
  // TASK CRUD
  // ─────────────────────────────────────────────

  /** Create a task — any authenticated user can do this */
  async createTask({ title, description, projectName, assignedTo, assignedBy, deadline, priority, subtasks = [] }) {
    // 1. Create the Task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || null,
        project_name: projectName || null,
        assigned_to: assignedTo,
        assigned_by: assignedBy,
        last_updated_by: assignedBy,
        deadline: deadline || null,
        priority: priority || 'Medium',
        status: 'pending',
        progress: 0,
      })
      .select(TASK_SELECT)
      .single();

    if (taskError) throw taskError;

    // 2. If we have subtasks, create a default group and the subtasks
    if (subtasks && subtasks.length > 0) {
      const { data: group, error: groupError } = await supabase
        .from('task_groups')
        .insert({ task_id: task.id, title: 'Checklist', sort_order: 0 })
        .select()
        .single();

      if (!groupError && group) {
        const subtaskPayloads = subtasks.map((st, idx) => ({
          group_id: group.id,
          title: st,
          sort_order: idx,
        }));
        await supabase.from('subtasks').insert(subtaskPayloads);
      }
    }

    // Return the task (re-fetch to get nested subtasks if they were created)
    const { data: finalTask } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', task.id)
      .single();

    return finalTask || task;
  },

  /**
   * General task update (status, progress, etc.)
   * Pass actorId + action metadata for audit log.
   */
  async updateTask(taskId, updates, actorId, actionType = 'updated', oldValue = null) {
    const payload = { ...updates, last_updated_by: actorId };
    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single();
    if (error) throw error;

    // Fire-and-forget audit log
    taskService.logActivity(taskId, actorId, actionType, oldValue, updates);
    return data;
  },

  /**
   * Assignee submits task for review once all subtasks are done.
   * Only the assignee can call this.
   */
  async submitForReview(taskId, actorId, oldStatus) {
    return taskService.updateTask(
      taskId,
      { status: 'review' },
      actorId,
      'status_changed',
      { status: oldStatus }
    );
  },

  /**
   * Assigner marks the reviewed task as done.
   * Only the original assigner (or HR) should call this.
   */
  async markAsDone(taskId, actorId, oldStatus) {
    return taskService.updateTask(
      taskId,
      { status: 'done', progress: 100 },
      actorId,
      'status_changed',
      { status: oldStatus }
    );
  },

  /** Mark as acknowledged when the assignee first opens the task */
  async acknowledgeTask(taskId, actorId) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw error;
    taskService.logActivity(taskId, actorId, 'acknowledged');
    return data;
  },

  // ─────────────────────────────────────────────
  // GROUPS + SUBTASKS
  // ─────────────────────────────────────────────

  async addGroup(taskId, title) {
    // Get current count to set sort_order
    const { count } = await supabase
      .from('task_groups')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    const { data, error } = await supabase
      .from('task_groups')
      .insert({ task_id: taskId, title, is_completed: false, sort_order: count || 0 })
      .select('*, subtasks(*)')
      .single();
    if (error) throw error;
    return data;
  },

  async toggleGroup(groupId, isCompleted) {
    const { data, error } = await supabase
      .from('task_groups')
      .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
      .eq('id', groupId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addSubtask(groupId, title, dueDate = null) {
    // Get current count to set sort_order
    const { count } = await supabase
      .from('subtasks')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    const { data, error } = await supabase
      .from('subtasks')
      .insert({ group_id: groupId, title, due_date: dueDate, sort_order: count || 0 })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleSubtask(subtaskId, isCompleted) {
    const { data, error } = await supabase
      .from('subtasks')
      .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
      .eq('id', subtaskId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ─────────────────────────────────────────────
  // COMMENTS
  // ─────────────────────────────────────────────

  async getComments(taskId) {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*, author:profiles!author_id(full_name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addComment(taskId, authorId, message) {
    const { data, error } = await supabase
      .from('task_comments')
      .insert({ task_id: taskId, author_id: authorId, message })
      .select('*, author:profiles!author_id(full_name, avatar_url)')
      .single();
    if (error) throw error;
    return data;
  },

  async toggleCommentResolution(commentId, isResolved) {
    const { data, error } = await supabase
      .from('task_comments')
      .update({ is_resolved: isResolved })
      .eq('id', commentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ─────────────────────────────────────────────
  // REORDERING (PERSISTENCE)
  // ─────────────────────────────────────────────

  async updateTaskOrder(orderedIds) {
    const updates = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
    const { error } = await supabase.from('tasks').upsert(updates);
    if (error) throw error;
  },

  async updateGroupOrder(orderedIds) {
    const updates = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
    const { error } = await supabase.from('task_groups').upsert(updates);
    if (error) throw error;
  },

  async updateSubtaskOrder(orderedIds) {
    const updates = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
    const { error } = await supabase.from('subtasks').upsert(updates);
    if (error) throw error;
  },

  // ─────────────────────────────────────────────
  // AUDIT LOG
  // ─────────────────────────────────────────────

  /** Non-throwing — audit failure must NEVER block user actions */
  async logActivity(taskId, actorId, actionType, oldValue = null, newValue = null) {
    try {
      await supabase.from('task_activity_logs').insert({
        task_id: taskId,
        actor_id: actorId,
        action_type: actionType,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
      });
    } catch (e) {
      console.warn('[taskService] Activity log failed (non-critical):', e.message);
    }
  },

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  /** Compute summary stats from a task array — no extra DB call needed */
  computeStats(tasks = []) {
    const today = new Date().toISOString().split('T')[0];
    return {
      total:           tasks.length,
      pending:         tasks.filter(t => t.status === 'pending').length,
      inProgress:      tasks.filter(t => t.status === 'in_progress').length,
      inReview:        tasks.filter(t => t.status === 'review').length,
      done:            tasks.filter(t => t.status === 'done').length,
      overdue:         tasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length,
      unacknowledged:  tasks.filter(t => !t.is_acknowledged && t.status !== 'done').length,
    };
  },

  /**
   * Calculate progress from subtask completion ratio.
   * Used after any toggle to keep the progress bar in sync.
   */
  calcProgress(taskGroups = []) {
    if (taskGroups.length === 0) return 0;
    const done = taskGroups.filter(g => g.isCompleted ?? g.is_completed).length;
    return Math.round((done / taskGroups.length) * 100);
  },

  /**
   * Returns true when EVERY subtask across all groups is completed.
   * Used to gate the "Submit for Review" button.
   */
  allSubtasksDone(taskGroups = []) {
    return taskGroups.length > 0 && taskGroups.every(g => g.isCompleted ?? g.is_completed);
  },

  /**
   * Export tasks to CSV and trigger download.
   * @param {Array} tasks — normalized task objects
   * @param {string} filename — file name without extension
   */
  exportToCSV(tasks = [], filename = 'organization_tasks') {
    const headers = ['Assignee', 'Employee ID', 'Task', 'Project', 'Department', 'Priority', 'Deadline', 'Progress', 'Status', 'Created At'];
    const rows = tasks.map(t => [
      t.assignedToName || 'Unassigned',
      t.assignee?.employee_id || 'N/A',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.project_name || 'Personal',
      t.departmentName || 'General',
      t.priority || 'Medium',
      t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB') : 'No deadline',
      `${t.progress || 0}%`,
      t.status || 'pending',
      t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
