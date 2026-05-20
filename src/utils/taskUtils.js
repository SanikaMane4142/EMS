/**
 * Normalize DB task shape → UI shape
 * Centralized to be used by both MyTasks and AdminTaskView.
 * Filters out soft-deleted groups and subtasks automatically.
 */
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', { 
      day: 'numeric', 
      month: 'short', 
      hour: 'numeric', 
      minute: 'numeric' 
    }).format(d);
  } catch (e) {
    return null;
  }
};

export const normalizeTask = (t) => ({
  ...t,
  assignedToName: t.assignee?.full_name || 'Unassigned',
  assignedByName: t.assigner?.full_name || 'Unknown',
  assigneeAvatar: t.assignee?.full_name ? t.assignee.full_name.charAt(0) : 'U',
  departmentName: t.assignee?.departments?.name || 'General',
  subtaskGroups: (t.task_groups || [])
    .filter(g => !g.is_deleted)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id))
    .map(g => ({
      ...g,
      isCompleted: g.is_completed,
      createdTime: formatDate(g.created_at || g.updated_at),
      updatedTime: formatDate(g.updated_at),
      items: (g.subtasks || [])
        .filter(s => !s.is_deleted)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id))
        .map(s => ({
          ...s,
          isCompleted: s.is_completed,
          date: s.due_date 
            ? new Date(s.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) 
            : s.updated_at ? new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No date',
          updatedTime: formatDate(s.updated_at),
          createdTime: formatDate(s.created_at || s.updated_at),
        }))
    })),
  createdTime: formatDate(t.created_at),
});

export const TASK_STATUS_STYLES = {
  pending: { label: 'Pending', color: 'slate' },
  in_progress: { label: 'In Progress', color: 'indigo' },
  review: { label: 'In Review', color: 'amber' },
  done: { label: 'Completed', color: 'emerald' },
};
