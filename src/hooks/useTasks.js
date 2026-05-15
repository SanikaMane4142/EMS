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
    staleTime: 5_000, // Reduced to 5s since we have realtime sync
  });

/** HR / Admin: all organisation tasks */
export const useAllTasks = () =>
  useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => taskService.getAllTasks(),
    staleTime: 5_000,
  });

/** Detailed task info (including subtasks) for modal view */
export const useTaskDetails = (taskId) =>
  useQuery({
    queryKey: ['tasks', 'detail', taskId],
    queryFn: () => taskService.getTaskById(taskId),
    enabled: !!taskId,
    staleTime: 5_000,
  });

/** Subtask groups for a specific task */
export const useTaskSubtasks = (taskId) =>
  useQuery({
    queryKey: ['task-subtasks', taskId],
    queryFn: () => taskService.getSubtaskGroups(taskId),
    enabled: !!taskId,
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

/** Delete a task (soft delete) */
export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId) => taskService.deleteTask(taskId),
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

/** Mark requested changes as completed */
export const useMarkChangesDone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, actorId }) => taskService.markChangesDone(taskId, actorId),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Toggle a subtask's completed state */
export const useToggleSubtask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subtaskId, isCompleted }) =>
      taskService.toggleSubtask(subtaskId, isCompleted),
    // Optimistic Update
    onMutate: async ({ subtaskId, isCompleted }) => {
      // Cancel refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['tasks'] });
      await qc.cancelQueries({ queryKey: ['task-subtasks'] });

      // Snapshot previous value
      const previousTasks = qc.getQueryData(['tasks', 'all']);

      // We could do deep optimistic update here, but for now just invalidating on success is safer
      // unless we want to implement the full state merging.
      // Let's stick to invalidation for now but with a very fast response.
      return { previousTasks };
    },
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

/** Update a group */
export const useUpdateGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, title, description }) =>
      taskService.updateGroup(groupId, title, description),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Update a subtask */
export const useUpdateSubtask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subtaskId, title, dueDate, description }) =>
      taskService.updateSubtask(subtaskId, title, dueDate, description),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Reorder top-level tasks */
export const useUpdateTaskOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds) => taskService.updateTaskOrder(orderedIds),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Reorder groups within a task */
export const useUpdateGroupOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds) => taskService.updateGroupOrder(orderedIds),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Reorder subtasks within a group */
export const useUpdateSubtaskOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds) => taskService.updateSubtaskOrder(orderedIds),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Soft delete a task group + its subtasks */
export const useSoftDeleteGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId) => taskService.softDeleteGroup(groupId),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Soft delete a single subtask */
export const useSoftDeleteSubtask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId) => taskService.softDeleteSubtask(subtaskId),
    onSuccess: () => invalidateAll(qc),
  });
};

/** Comments for a task */
export const useTaskComments = (taskId) => {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => taskService.getComments(taskId),
    enabled: !!taskId,
  });
};

/** Add a comment */
export const useAddComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, authorId, message }) => 
      taskService.addComment(taskId, authorId, message),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
  });
};

/** Toggle comment resolution status */
export const useToggleCommentResolution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, isResolved }) => 
      taskService.toggleCommentResolution(commentId, isResolved),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
  });
};
