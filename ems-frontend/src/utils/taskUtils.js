/**
 * Normalize DB task shape → UI shape
 * Centralized to be used by both MyTasks and AdminTaskView
 */
export const normalizeTask = (t) => ({
  ...t,
  assignedToName: t.assignee?.full_name || 'Unassigned',
  assignedByName: t.assigner?.full_name || 'Unknown',
  assigneeAvatar: t.assignee?.full_name ? t.assignee.full_name.charAt(0) : 'U',
  departmentName: t.assignee?.departments?.name || 'General',
  subtaskGroups: (t.task_groups || [])
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id))
    .map(g => ({
      ...g,
      isCompleted: g.is_completed,
      items: (g.subtasks || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id))
        .map(s => ({
          ...s,
          isCompleted: s.is_completed,
          date: s.due_date ? new Date(s.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No date',
          updatedTime: s.updated_at ? new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        }))
    }))
});

export const TASK_STATUS_STYLES = {
  pending: { label: 'Pending', color: 'slate' },
  in_progress: { label: 'In Progress', color: 'indigo' },
  review: { label: 'In Review', color: 'amber' },
  done: { label: 'Completed', color: 'emerald' },
};
