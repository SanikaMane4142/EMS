import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../services/taskService';

// ─────────────────────────────────────────────
// QUERY HOOKS
// ─────────────────────────────────────────────

/**
 * Employee: tasks assigned to them OR created by them.
 * Enabled only when userId is available.
 */
export const useMyTasks = (userId) =>
  useQuery({
    queryKey: ['tasks', 'mine', userId],
    queryFn: () => taskService.getMyTasks(userId),
    enabled: !!userId,
    staleTime: 30_000, // 30 s — tasks don't change every second
  });

/** HR / Admin: all organisation tasks */
export const useAllTasks = () =>
  useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => taskService.getAllTasks(),
    staleTime: 30_000,
  });

/** Activity log for a single task (HR detail panel) */
export const useTaskActivityLog = (taskId) =>
  useQuery({
    queryKey: ['tasks', 'activity', taskId],
    queryFn: () => taskService.getActivityLog(taskId),
    enabled: !!taskId,
  });

// ─────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────

const invalidateAll = (qc) => {
  qc.invalidateQueries({ queryKey: ['tasks'] });
};

/** Create a new task — any authenticated user */
export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => taskService.createTask(payload),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Generic task update (status, progress, etc.) */
export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, updates, actorId, actionType, oldValue }) =>
      taskService.updateTask(taskId, updates, actorId, actionType, oldValue),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Assignee submits task for review */
export const useSubmitForReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, actorId, oldStatus }) =>
      taskService.submitForReview(taskId, actorId, oldStatus),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Assigner marks task as done after review */
export const useMarkAsDone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, actorId, oldStatus }) =>
      taskService.markAsDone(taskId, actorId, oldStatus),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Acknowledge task (fires once when assignee first opens the workspace) */
export const useAcknowledgeTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, actorId }) => taskService.acknowledgeTask(taskId, actorId),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Toggle a subtask's completed state */
export const useToggleSubtask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subtaskId, isCompleted }) =>
      taskService.toggleSubtask(subtaskId, isCompleted),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Toggle a group's completed state */
export const useToggleGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, isCompleted }) =>
      taskService.toggleGroup(groupId, isCompleted),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Add a group (section) to a task */
export const useAddGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, title }) => taskService.addGroup(taskId, title),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Add a subtask row to a group */
export const useAddSubtask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, title, dueDate }) =>
      taskService.addSubtask(groupId, title, dueDate),
    onSuccess: () => invalidateAll(qc),
  });
};
