import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, MoreVertical, Calendar,
  ChevronRight, Share2, GripVertical,
  CheckCircle, Briefcase, ChevronUp, ChevronDown as ChevronDownIcon, Layout,
  Check, PlayCircle, AlertCircle, SendHorizonal, ThumbsUp, MessageCircle,
  CornerUpLeft, CheckCircle2, History, Zap, LayoutGrid, List, AlignLeft, Columns,
  Filter, Layers, Clock, Trash2, Pencil
} from "lucide-react";
import { Box, Avatar, IconButton, Collapse, Menu, MenuItem, CircularProgress, Skeleton, Dialog } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import PageHeader from '../components/PageHeader';
import CreateTaskModal from "../components/CreateTaskModal";
import AddTaskModal from "../components/AddTaskModal";
import { useAuth } from '../context/AuthContext';
import {
  useMyTasks, useCreateTask, useToggleSubtask, useToggleGroup,
  useSubmitForReview, useMarkAsDone, useAddGroup, useAddSubtask,
  useUpdateTaskOrder, useUpdateGroupOrder, useUpdateSubtaskOrder,
  useUpdateTask, useTaskComments, useAddComment, useToggleCommentResolution,
  useMarkChangesDone, useDeleteTask, useSoftDeleteGroup, useSoftDeleteSubtask,
  useUpdateGroup, useUpdateSubtask
} from '../hooks/useTasks';
import { taskService } from '../services/taskService';
import { notificationService } from '../services/notificationService';
import { normalizeTask, TASK_STATUS_STYLES } from '../utils/taskUtils';
import { supabase } from "../lib/supabaseClient";

/** Priority Badge Component */

// --- Sub-components ---

const PriorityBadge = ({ priority }) => {
  const styles = {
    High: "bg-red-50 text-red-500 border-red-100",
    Medium: "bg-amber-50 text-amber-600 border-amber-100",
    Low: "bg-emerald-50 text-emerald-600 border-emerald-100",
    Critical: "bg-red-600 text-white border-red-700"
  };
  const dotColors = {
    High: "bg-red-500",
    Medium: "bg-amber-500",
    Low: "bg-emerald-500",
    Critical: "bg-white"
  };
  return (
    <span className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest inline-flex items-center gap-2 ${styles[priority] || styles.Low}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[priority] || dotColors.Low}`}></span>
      {priority}
    </span>
  );
};

const StatusChip = ({ status }) => {
  const config = TASK_STATUS_STYLES[status] || { label: status, color: 'slate' };
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-50 text-slate-500 border-slate-200",
    red: "bg-red-50 text-red-600 border-red-100"
  };

  // Special case: Completed tasks use the pending (slate) background but green text
  let className = colorMap[config.color];
  if (status === 'done') {
    className = "bg-slate-50 text-emerald-600 border-emerald-100";
  }

  return (
    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${className}`}>
      {config.label}
    </span>
  );
};

const getProgressColor = (progress, status) => {
  if (status === 'done' || progress >= 50) return 'bg-emerald-500 shadow-sm shadow-emerald-100';
  if (status === 'review') return 'bg-amber-500';
  return 'bg-indigo-600';
};

// --- Sortable Components ---

const SortableTaskItem = ({ task, isActive, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(task)}
      className={`p-3 rounded-xl cursor-pointer border transition-all group relative ${isActive ? 'border-primary/20 bg-white shadow-md shadow-primary/5' : 'border-transparent bg-slate-50/40 hover:bg-white hover:shadow-sm'
        }`}
    >
      <div {...attributes} {...listeners} className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-200 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
        <GripVertical size={12} />
      </div>
      <div className="pl-2.5">
        <div className="flex justify-between items-start mb-1.5">
          <h4 className={`text-[10px] font-bold leading-tight transition-colors ${isActive ? 'text-primary' : 'text-slate-700 group-hover:text-primary'}`}>
            {task.title}
          </h4>
          <ChevronRight size={10} className={isActive ? 'text-primary' : 'text-slate-300'} />
        </div>
        <div className="flex items-center gap-1.5 mb-2 text-[8px] font-medium text-slate-400 uppercase tracking-tight">
          <span>{new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${task.progress}%` }}></div>
          </div>
          <span className="text-[8px] font-bold text-primary">{task.progress}%</span>
        </div>
      </div>
    </div>
  );
};

const SortableSubtaskItem = ({ item, onToggle, canEdit = true, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : item.isCompleted ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 py-2 px-4 transition-all group/item border-b border-slate-50/50 last:border-none ${item.isCompleted ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : 'hover:bg-primary/5'
        }`}
    >
      {canEdit ? (
        <div {...attributes} {...listeners} className="w-8 flex items-center justify-center text-slate-200 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 transition-opacity">
          <GripVertical size={14} />
        </div>
      ) : (
        <div className="w-8" />
      )}
      
      {/* Spacer to match group index width */}
      <div className="w-6" />

      <div className="flex-1 flex flex-col justify-center min-w-0 pl-2">
        <span className={`text-[11px] font-bold truncate transition-all duration-300 ${item.isCompleted ? 'text-emerald-700/60 line-through' : 'text-slate-700'
          }`}>
          {item.title}
        </span>
      </div>

      <div className="flex items-center justify-end gap-6">
        <div className="flex items-center justify-end w-[160px]">
          {item.createdTime && (
            <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              <Calendar size={12} className="text-slate-300" />
              {item.createdTime}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end w-[160px]">
          {(item.updatedTime || item.date) && (
            <div className="flex items-center gap-1.5 text-[8px] font-bold text-indigo-500 uppercase tracking-widest whitespace-nowrap">
              <Clock size={12} className="text-indigo-400" />
              {item.updatedTime ? item.updatedTime : item.date}
            </div>
          )}
          {canEdit && onDelete && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(item); }}
              className="ml-2 w-6 h-6 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-all"
            >
              <Trash2 size={13} />
            </IconButton>
          )}
        </div>

        <div className="w-[48px] flex justify-center">
          <button
            disabled={!canEdit}
            onClick={() => onToggle(item.id)}
            className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all duration-300 ${item.isCompleted
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
              : 'bg-white border-2 border-slate-200 text-transparent hover:border-emerald-500 hover:bg-emerald-50'
              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${item.isCompleted ? 'scale-100' : 'scale-0'}`} />
          </button>
        </div>
        
        {/* Trailing spacer to match group arrow column */}
        <div className="w-[28px]" />
      </div>
    </div>
  );
};

const SortableGroup = ({ group, index, expanded, onToggle, onAddItem, isLast, onToggleGroup, canEdit = true, onDeleteGroup, onDeleteSubtask }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id, disabled: !canEdit });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1
  };

  const isGroupCompleted = group.isCompleted;

  return (
    <div ref={setNodeRef} style={style} className={`transition-all bg-white ${!isLast ? 'border-b border-slate-100/50' : ''}`}>
      <div className="py-2.5 px-4 flex items-center justify-center bg-slate-50/30 group/header">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {canEdit ? (
              <div {...attributes} {...listeners} className="w-8 flex items-center justify-center text-slate-200 cursor-grab active:cursor-grabbing opacity-0 group-hover/header:opacity-100 transition-opacity">
                <GripVertical size={14} />
              </div>
            ) : (
              <div className="w-8" />
            )}
            <div className="w-6 h-6 rounded bg-white text-primary border border-primary/10 flex items-center justify-center font-bold text-[10px]">
              {index + 1}
            </div>
            <h4 className="text-[12px] font-bold text-slate-900 tracking-tight ml-2">{group.title}</h4>
          </div>

          <div className="flex items-center justify-end gap-6">
            <div className="flex items-center justify-end w-[160px]">
              {group.createdTime && (
                <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  <Calendar size={12} className="text-slate-300" />
                  {group.createdTime}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-1 w-[160px]">
              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${group.items.length > 0 && group.items.every(i => i.isCompleted) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                {group.items.filter(i => i.isCompleted).length}/{group.items.length} DONE
              </span>
              {canEdit && (
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onAddItem(group.id); }}
                  className="w-6 h-6 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus size={14} />
                </IconButton>
              )}
              {canEdit && group.onEdit && (
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); group.onEdit(group); }}
                  className="w-6 h-6 rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 opacity-0 group-hover/header:opacity-100 transition-all"
                >
                  <Pencil size={13} />
                </IconButton>
              )}
              {canEdit && onDeleteGroup && (
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }}
                  className="w-6 h-6 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/header:opacity-100 transition-all"
                >
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>

            <div className="w-[48px] flex justify-center">
              <button
                disabled={!canEdit}
                onClick={(e) => { e.stopPropagation(); onToggleGroup(group.id, !isGroupCompleted); }}
                className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all duration-300 ${isGroupCompleted
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                  : group.items.length > 0 && !group.items.every(i => i.isCompleted)
                    ? 'bg-slate-50 border-2 border-slate-100 text-slate-200 cursor-not-allowed'
                    : 'bg-white border-2 border-slate-200 text-transparent hover:border-emerald-500 hover:bg-emerald-50'
                  } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {group.items.length > 0 && !group.items.every(i => i.isCompleted) && !isGroupCompleted ? (
                  <AlertCircle size={10} />
                ) : (
                  <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${isGroupCompleted ? 'scale-100' : 'scale-0'}`} />
                )}
              </button>
            </div>

            <div className="w-[28px] flex justify-center">
              <IconButton
                size="small"
                onClick={() => onToggle(group.id)}
                className={`w-6 h-6 rounded text-slate-400 transition-all ${expanded ? 'bg-slate-50' : ''}`}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDownIcon size={14} />}
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      <Collapse in={expanded}>
        <div className="bg-white">
          <SortableContext items={group.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {group.items.map(item => (
              <SortableSubtaskItem key={item.id} item={item} onToggle={(id) => onToggleGroup(group.id, id)} canEdit={canEdit} onDelete={canEdit && onDeleteSubtask ? (itm) => onDeleteSubtask(itm) : undefined} />
            ))}
          </SortableContext>
        </div>
      </Collapse>
    </div>
  );
};

// --- Main Components ---

const TaskWorkspace = ({ activeTask, allTasks, onTaskSelect, onBack, onAddTask, currentUserId, onSubmitReview, onMarkDone }) => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState(allTasks);
  const [taskGroups, setTaskGroups] = useState(activeTask.subtaskGroups || []);
  const [expandedGroups, setExpandedGroups] = useState(activeTask.subtaskGroups?.map(g => g.id) || []);
  const [switcherAnchor, setSwitcherAnchor] = useState(null);
  const [isAddGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState(null);
  const [editItemData, setEditItemData] = useState(null);

  // Real mutations
  const toggleSubtask = useToggleSubtask();
  const toggleGroupMutation = useToggleGroup();
  const addGroupMutation = useAddGroup();
  const addSubtaskMutation = useAddSubtask();
  const updateTaskOrder = useUpdateTaskOrder();
  const updateGroupOrder = useUpdateGroupOrder();
  const updateSubtaskOrder = useUpdateSubtaskOrder();
  const updateTaskMutation = useUpdateTask();
  const markChangesDoneMutation = useMarkChangesDone();
  const submitForReviewMutation = useSubmitForReview();
  const markAsDoneMutation = useMarkAsDone();
  const softDeleteGroupMutation = useSoftDeleteGroup();
  const softDeleteSubtaskMutation = useSoftDeleteSubtask();
  const updateGroupMutation = useUpdateGroup();
  const updateSubtaskMutation = useUpdateSubtask();

  const [statusAnchor, setStatusAnchor] = useState(null);
  const [reviewModal, setReviewModal] = useState({ open: false, type: 'approve' }); // type: 'approve' | 'request_changes'
  const [reviewNote, setReviewNote] = useState('');

  const { data: comments = [], isLoading: commentsLoading } = useTaskComments(activeTask.id);
  const addCommentMutation = useAddComment();
  const toggleCommentResolution = useToggleCommentResolution();

  // Derived state for workflow buttons
  const isAssignee = activeTask.assigned_to === currentUserId;
  const isAssigner = activeTask.assigned_by === currentUserId;
  const canEdit = (isAssignee || (isAssigner && !activeTask.is_acknowledged)) && activeTask.status !== 'done';
  const allDone = taskService.allSubtasksDone(taskGroups);

  // Workflow Logic: Check if there are any unresolved "Changes Requested" comments
  const unresolvedChanges = comments.some(c =>
    c.message.includes('Changes Requested') && !c.is_resolved
  );

  const canSubmitReview = isAssignee && allDone && activeTask.status === 'in_progress' && !unresolvedChanges;
  const canMarkDone = isAssigner && activeTask.status === 'review';
  const canRequestChanges = isAssigner && activeTask.status === 'review';

  const handleCreateGroupOrItem = async (data) => {
    if (data.isEdit) {
      if (editItemData.type === 'group') {
        await updateGroupMutation.mutateAsync({ groupId: data.id, title: data.name, description: data.description });
      } else {
        await updateSubtaskMutation.mutateAsync({ subtaskId: data.id, title: data.name, dueDate: data.dueDate, description: data.description });
      }
      setAddGroupModalOpen(false);
      setEditItemData(null);
      return;
    }

    if (addingToGroupId) {
      // Add real subtask to DB
      await addSubtaskMutation.mutateAsync({
        groupId: addingToGroupId,
        title: data.name,
        dueDate: data.dueDate || null,
      });
      setAddingToGroupId(null);
      setAddGroupModalOpen(false);
    } else {
      // Add real group to DB
      await addGroupMutation.mutateAsync({ taskId: activeTask.id, title: data.name });
      setAddGroupModalOpen(false);
    }
  };

  // --- Soft Delete Handlers ---
  const handleDeleteGroup = async (group) => {
    const { default: Swal } = await import('sweetalert2');
    // Check if any subtask is completed
    const hasCompletedSubtask = group.items.some(i => i.isCompleted);
    if (hasCompletedSubtask) {
      Swal.fire({
        title: 'Cannot Delete',
        text: 'Cannot delete this task because one or more mini tasks are already completed.',
        icon: 'warning',
        confirmButtonColor: '#4F46E5',
        customClass: { popup: 'rounded-[24px]', confirmButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest' }
      });
      return;
    }
    const result = await Swal.fire({
      title: 'Delete Task Group?',
      text: `Are you sure you want to delete "${group.title}" and all its subtasks?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Yes, delete it',
      customClass: { popup: 'rounded-[24px]', confirmButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest', cancelButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest' }
    });
    if (result.isConfirmed) {
      try {
        await softDeleteGroupMutation.mutateAsync(group.id);
        // Optimistic: remove from local state
        setTaskGroups(prev => prev.filter(g => g.id !== group.id));
      } catch (err) {
        Swal.fire('Error', err.message || 'Failed to delete group', 'error');
      }
    }
  };

  const handleDeleteSubtask = async (item) => {
    const { default: Swal } = await import('sweetalert2');
    if (item.isCompleted) {
      Swal.fire({
        title: 'Cannot Delete',
        text: 'Completed mini tasks cannot be deleted.',
        icon: 'warning',
        confirmButtonColor: '#4F46E5',
        customClass: { popup: 'rounded-[24px]', confirmButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest' }
      });
      return;
    }
    const result = await Swal.fire({
      title: 'Delete Mini Task?',
      text: `Are you sure you want to delete "${item.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Yes, delete it',
      customClass: { popup: 'rounded-[24px]', confirmButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest', cancelButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest' }
    });
    if (result.isConfirmed) {
      try {
        await softDeleteSubtaskMutation.mutateAsync(item.id);
        // Optimistic: remove from local state
        setTaskGroups(prev => prev.map(g => ({
          ...g,
          items: g.items.filter(i => i.id !== item.id)
        })));
      } catch (err) {
        Swal.fire('Error', err.message || 'Failed to delete subtask', 'error');
      }
    }
  };

  useEffect(() => {
    setTasks(allTasks);
  }, [allTasks]);

  useEffect(() => {
    setTaskGroups(activeTask.subtaskGroups || []);
    setExpandedGroups(activeTask.subtaskGroups?.map(g => g.id) || []);
  }, [activeTask]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Optimistic toggle: update local state immediately, then persist
  const handleToggleGroupStatus = async (groupId, itemIdOrStatus) => {
    if (typeof itemIdOrStatus === 'string') {
      // Individual subtask toggle (MINI TASKS)
      const subtaskId = itemIdOrStatus;
      const group = taskGroups.find(g => g.id === groupId);
      const item = group?.items.find(i => i.id === subtaskId);
      if (!item) return;

      // AUTO-UNTICK PARENT RULE:
      // If we are UNCHECKING a mini-task, and the group was previously checked,
      // we must automatically uncheck the group to maintain integrity.
      const willBeCompleted = !item.isCompleted;
      const shouldAutoUntickGroup = !willBeCompleted && group.isCompleted;

      // Optimistic update
      setTaskGroups(prev => prev.map(g =>
        g.id === groupId
          ? {
            ...g,
            isCompleted: shouldAutoUntickGroup ? false : g.isCompleted,
            items: g.items.map(i => i.id === subtaskId ? { ...i, isCompleted: willBeCompleted } : i)
          }
          : g
      ));

      // Persist subtask status
      try {
        await toggleSubtask.mutateAsync({ subtaskId, isCompleted: willBeCompleted });

        // If we auto-unticked the group, persist that too and update task progress
        if (shouldAutoUntickGroup) {
          await toggleGroupMutation.mutateAsync({ groupId, isCompleted: false });
          const updatedGroups = taskGroups.map(g =>
            g.id === groupId ? { ...g, isCompleted: false } : g
          );
          const newProgress = taskService.calcProgress(updatedGroups);
          await taskService.updateTask(activeTask.id, { progress: newProgress }, currentUserId, 'progress_updated');
        }
      } catch {
        // Rollback is complex here, but usually mutations succeed. 
        // For simplicity in this workspace, we keep the optimistic state.
      }
    } else {
      // Group-level toggle (SUBTASKS - manual only)
      const newCompleted = itemIdOrStatus;
      const group = taskGroups.find(g => g.id === groupId);
      if (!group) return;

      // Validation: Cannot complete group if mini-tasks are pending
      if (newCompleted) {
        const allMiniTasksDone = group.items.length === 0 || group.items.every(i => i.isCompleted);
        if (!allMiniTasksDone) {
          import('sweetalert2').then(module => {
            const Swal = module.default;
            Swal.fire({
              title: 'Tasks Pending',
              text: 'Please complete all mini-tasks within this section before marking the entire group as finished.',
              icon: 'warning',
              confirmButtonColor: '#4F46E5',
              customClass: {
                popup: 'rounded-[24px]',
                confirmButton: 'rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest'
              }
            });
          });
          return;
        }
      }

      // Calculate new progress based on groups
      const updatedGroups = taskGroups.map(g =>
        g.id === groupId ? { ...g, isCompleted: newCompleted } : g
      );
      const newProgress = taskService.calcProgress(updatedGroups);

      // Optimistic update
      setTaskGroups(updatedGroups);

      try {
        // 1. Persist group status
        await toggleGroupMutation.mutateAsync({ groupId, isCompleted: newCompleted });
        // 2. Update overall task progress
        await taskService.updateTask(activeTask.id, { progress: newProgress }, currentUserId, 'progress_updated');
      } catch (err) {
        // Rollback
        setTaskGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, isCompleted: !newCompleted } : g
        ));
      }
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // 1. Reorder Top-Level Tasks
    if (tasks.some(t => t.id === active.id)) {
      const oldIndex = tasks.findIndex(t => t.id === active.id);
      const newIndex = tasks.findIndex(t => t.id === over.id);
      if (newIndex === -1) return; // dropped on wrong target
      const prevTasks = [...tasks];
      const newOrder = arrayMove(tasks, oldIndex, newIndex);
      setTasks(newOrder);
      try {
        await updateTaskOrder.mutateAsync(newOrder.map(t => t.id));
      } catch (err) {
        console.error('[DnD] Task reorder failed:', err);
        setTasks(prevTasks);
      }
      return;
    }

    // 2. Reorder Task Groups
    if (taskGroups.some(g => g.id === active.id)) {
      const oldIndex = taskGroups.findIndex(g => g.id === active.id);
      const newIndex = taskGroups.findIndex(g => g.id === over.id);
      if (newIndex === -1) return; // dropped on wrong target (e.g. subtask)
      const prevGroups = [...taskGroups];
      const newOrder = arrayMove(taskGroups, oldIndex, newIndex);
      setTaskGroups(newOrder);
      try {
        await updateGroupOrder.mutateAsync(newOrder.map(g => g.id));
      } catch (err) {
        console.error('[DnD] Group reorder failed:', err);
        setTaskGroups(prevGroups);
      }
      return;
    }

    // 3. Reorder Subtasks within a group
    for (const group of taskGroups) {
      if (group.items.some(i => i.id === active.id)) {
        const oldIndex = group.items.findIndex(i => i.id === active.id);
        const newIndex = group.items.findIndex(i => i.id === over.id);

        if (newIndex !== -1) {
          const prevGroups = [...taskGroups];
          const newItems = arrayMove(group.items, oldIndex, newIndex);
          const updatedGroups = taskGroups.map(g =>
            g.id === group.id ? { ...g, items: newItems } : g
          );

          setTaskGroups(updatedGroups);
          try {
            await updateSubtaskOrder.mutateAsync(newItems.map(i => i.id));
          } catch (err) {
            console.error('[DnD] Subtask reorder failed:', err);
            setTaskGroups(prevGroups);
          }
        }
        break;
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusAnchor(null);
    if (newStatus === activeTask.status) return;

    // Safety: Assignees can only manually set to Pending or In Progress
    if (isAssignee && !isAssigner && !['pending', 'in_progress'].includes(newStatus)) {
      return;
    }

    try {
      await updateTaskMutation.mutateAsync({
        taskId: activeTask.id,
        updates: { status: newStatus },
        actorId: currentUserId,
        actionType: 'status_changed',
        oldValue: { status: activeTask.status }
      });

      // Notify assigner if status is 'review'
      if (newStatus === 'review' && activeTask.assigned_by && activeTask.assigned_by !== currentUserId) {
        notificationService.notifyUser?.(
          activeTask.assigned_by,
          'Task Ready for Review',
          `${profile?.full_name} moved "${activeTask.title}" to Review.`,
          'task',
          '/my-tasks'
        );
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleReviewAction = async () => {
    const isApprove = reviewModal.type === 'approve';
    const newStatus = isApprove ? 'done' : 'in_progress';
    const actionLabel = isApprove ? 'Approved' : 'Changes Requested';

    try {
      // 1. Primary Action: Update status
      if (isApprove) {
        await markAsDoneMutation.mutateAsync({
          taskId: activeTask.id,
          actorId: currentUserId,
          oldStatus: activeTask.status
        });
      } else {
        await updateTaskMutation.mutateAsync({
          taskId: activeTask.id,
          updates: {
            status: newStatus,
            progress: 50,
            needs_changes: true,
            changes_completed: false
          },
          actorId: currentUserId,
          actionType: 'status_changed',
          oldValue: { status: activeTask.status }
        });
      }

      // 2. Secondary Actions (Don't let these block the UI if they fail)
      try {
        // Feedback comment
        if (reviewNote.trim()) {
          await addCommentMutation.mutateAsync({
            taskId: activeTask.id,
            authorId: currentUserId,
            message: `**${actionLabel}**: ${reviewNote}`
          });
        }

        // Notification
        if (activeTask.assigned_to && activeTask.assigned_to !== currentUserId) {
          notificationService.notifyUser?.(
            activeTask.assigned_to,
            `Task ${actionLabel}`,
            `${profile?.full_name} ${isApprove ? 'approved' : 'requested changes on'} "${activeTask.title}".`,
            'task',
            '/my-tasks'
          );
        }
      } catch (secondaryErr) {
        console.warn('Review metadata (comment/notif) failed, but task was updated:', secondaryErr);
      }

      // 3. UI Cleanup
      setReviewModal({ open: false, type: 'approve' });
      setReviewNote('');

      // Optional: Visual confirmation
      console.log(`Task ${actionLabel} successfully.`);
    } catch (err) {
      console.error('Review action failed:', err);
      alert(`Action failed: ${err.message || 'Unknown error'}. Please check your database connection.`);
    }
  };

  const doneGroups = taskGroups.filter(g => g.isCompleted).length;
  const totalGroups = taskGroups.length;
  const workspaceProgress = totalGroups > 0 ? Math.round((doneGroups / totalGroups) * 100) : 0;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col lg:flex-row gap-6 max-w-[1320px] mx-auto min-h-[calc(100vh-180px)] px-4"
      >
        {/* Left Sidebar */}
        <div className="w-full lg:w-[256px] flex flex-col gap-3 flex-shrink-0">
          <div className="flex justify-between items-center px-1 mb-1">
            <button
              onClick={(e) => setSwitcherAnchor(e.currentTarget)}
              className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-[0.12em] hover:text-primary transition-colors bg-white/40 backdrop-blur-md border border-white/40 px-3 py-1.5 rounded-xl shadow-sm"
            >
              <Layout size={12} /> Switcher <ChevronDownIcon size={10} />
            </button>
            <IconButton className="w-7 h-7 bg-primary text-white hover:bg-primary-hover rounded-xl shadow-sm shadow-primary/10 transition-all p-0">
              <Plus size={16} />
            </IconButton>
          </div>

          <Menu
            anchorEl={switcherAnchor}
            open={Boolean(switcherAnchor)}
            onClose={() => setSwitcherAnchor(null)}
            slotProps={{
              paper: { sx: { width: 240, mt: 0.5, borderRadius: '12px', p: 0.75, boxShadow: 'var(--shadow-premium)', border: '1px solid var(--border-light)' } }
            }}
          >
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map(t => (
                <MenuItem
                  key={t.id}
                  onClick={() => { onTaskSelect(t); setSwitcherAnchor(null); }}
                  sx={{ borderRadius: '8px', mb: 0.25, py: 0.75, px: 1.5 }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={`w-1 h-1 rounded-full ${t.id === activeTask.id ? 'bg-primary' : 'bg-slate-200'}`}></div>
                    <span className={`text-[10px] font-bold ${t.id === activeTask.id ? 'text-primary' : 'text-slate-600'}`}>{t.title}</span>
                  </div>
                </MenuItem>
              ))}
            </SortableContext>
          </Menu>

          <div className="bg-white rounded-[20px] border border-slate-100 p-1 shadow-sm flex flex-col gap-1">
            <div className="p-1 mb-1.5">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  className="w-full h-8 pl-8 pr-2 bg-slate-50/30 border border-slate-100/50 rounded-xl text-[9px] font-bold text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary/5 focus:bg-white transition-all shadow-none"
                  placeholder="Filter tasks..."
                />
              </div>
            </div>
            <SortableTaskItem task={activeTask} isActive={true} onClick={() => { }} />
          </div>

          <div className="p-4 rounded-[20px] bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-2 flex items-center justify-center">
              <CircularProgress
                variant="determinate"
                value={workspaceProgress}
                size={52}
                thickness={5}
                sx={{
                  color: workspaceProgress >= 100 ? 'var(--emerald-500)' : 'var(--primary)',
                  '& .MuiCircularProgress-circle': { strokeLinecap: 'round' }
                }}
              />
              <CircularProgress
                variant="determinate"
                value={100}
                size={52}
                thickness={5}
                sx={{
                  color: 'var(--border-light)',
                  position: 'absolute',
                  zIndex: -1
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-[11px] font-bold ${workspaceProgress >= 100 ? 'text-emerald-600' : 'text-slate-900'}`}>{workspaceProgress}%</span>
              </div>
            </div>
            <h4 className="text-[10px] font-bold text-slate-700 mb-0.5 tracking-tight">Workspace Progress</h4>
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-2">{doneGroups} of {totalGroups} completed</p>
            <div className={`flex items-center gap-1 px-2 py-0.5 text-[7px] font-bold rounded-full border uppercase tracking-wider ${workspaceProgress >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-success-light/30 text-success border-success/10'
              }`}>
              <Zap size={8} fill="currentColor" /> {workspaceProgress >= 100 ? 'All Finished' : 'On Track'}
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col gap-5 w-full">
            <div className="flex flex-col gap-4">
              {/* Task Title Section */}
              <div className="flex items-center gap-3 px-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{activeTask.title}</h1>
                <PriorityBadge priority={activeTask.priority} />
                {unresolvedChanges && (
                  <span className="text-[10px] font-black px-3 py-1 bg-red-50 text-red-500 border border-red-100 rounded-full uppercase tracking-widest animate-pulse">
                    Changes Requested
                  </span>
                )}
                {activeTask.needs_changes && !unresolvedChanges && (
                  <span className="text-[10px] font-black px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full uppercase tracking-widest">
                    Changes Resolved
                  </span>
                )}
              </div>

              {/* UNIFIED MINIMAL METADATA BAR */}
              <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between gap-6 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-8 h-10 pr-2">
                {/* Assignee & Assigner Context */}
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assignee</span>
                    <div className="flex items-center gap-2">
                      <Avatar sx={{ width: 22, height: 22, bgcolor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800, fontSize: 9 }}>{(activeTask.assignedToName || 'U').charAt(0)}</Avatar>
                      <span className="text-[11px] font-bold text-slate-900">{activeTask.assignedToName}</span>
                    </div>
                  </div>

                  <div className="w-px h-8 bg-slate-100"></div>

                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned By</span>
                    <div className="flex items-center gap-2">
                      <Avatar sx={{ width: 22, height: 22, bgcolor: 'var(--emerald-50)', color: 'var(--emerald-600)', fontWeight: 800, fontSize: 9 }}>{(activeTask.assignedByName || 'S').charAt(0)}</Avatar>
                      <span className="text-[11px] font-bold text-slate-900">{activeTask.assignedByName}</span>
                    </div>
                  </div>
                </div>

                <div className="w-px h-6 bg-slate-100"></div>

                {/* Due Date */}
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-slate-400" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                      {activeTask.deadline ? new Date(activeTask.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline'}
                    </span>
                    {activeTask.deadline && new Date(activeTask.deadline) < new Date() && activeTask.status !== 'done' && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-red-100 text-red-500 rounded uppercase tracking-tighter">Overdue</span>
                    )}
                  </div>
                </div>

                <div className="w-px h-6 bg-slate-100"></div>

                {/* Status Picker */}
                <div className="flex items-center gap-2.5">
                  <button
                    disabled={!isAssignee || activeTask.status === 'review' || activeTask.status === 'done'}
                    onClick={(e) => setStatusAnchor(e.currentTarget)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all border ${activeTask.status === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      activeTask.status === 'review' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-success-light/20 text-success border-success/10'
                      } ${isAssignee && activeTask.status !== 'review' && activeTask.status !== 'done' ? 'hover:bg-white hover:shadow-sm cursor-pointer' : 'cursor-default opacity-80'}`}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-current opacity-20">
                      {activeTask.status === 'done' ? <CheckCircle size={12} /> : <PlayCircle size={12} />}
                    </div>
                    <span className="text-[11px] font-bold whitespace-nowrap uppercase tracking-wider">
                      {TASK_STATUS_STYLES[activeTask.status]?.label || activeTask.status}
                    </span>
                    {isAssignee && activeTask.status !== 'review' && activeTask.status !== 'done' && <ChevronDownIcon size={10} className="opacity-50" />}
                  </button>

                  <Menu
                    anchorEl={statusAnchor}
                    open={Boolean(statusAnchor)}
                    onClose={() => setStatusAnchor(null)}
                    slotProps={{
                      paper: { sx: { width: 160, mt: 0.5, borderRadius: '12px', p: 0.5, boxShadow: 'var(--shadow-premium)', border: '1px solid var(--border-light)' } }
                    }}
                  >
                    {Object.entries(TASK_STATUS_STYLES)
                      .filter(([val]) => val === 'pending' || val === 'in_progress') // Restrict to Pending and In Progress for assignee
                      .map(([val, config]) => (
                        <MenuItem
                          key={val}
                          onClick={() => handleStatusChange(val)}
                          sx={{
                            borderRadius: '8px',
                            py: 1,
                            px: 1.5,
                            bgcolor: activeTask.status === val ? 'var(--primary-light)' : 'transparent',
                            '&:hover': { bgcolor: 'var(--slate-50)' }
                          }}
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTask.status === val ? 'text-primary' : 'text-slate-600'}`}>
                            {config.label}
                          </span>
                        </MenuItem>
                      ))}
                  </Menu>
                </div>

                {/* Workflow Buttons */}
                {activeTask.status !== 'done' && (
                  <div className="flex items-center gap-2">
                    {canSubmitReview && (
                      <button
                        onClick={() => submitForReviewMutation.mutate({
                          taskId: activeTask.id,
                          actorId: currentUserId,
                          oldStatus: activeTask.status
                        })}
                        disabled={submitForReviewMutation.isPending}
                        className="h-8 px-4 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
                      >
                        {submitForReviewMutation.isPending ? (
                          <CircularProgress size={12} color="inherit" />
                        ) : (
                          <>
                            <SendHorizonal size={12} strokeWidth={3} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            Submit for Review
                          </>
                        )}
                      </button>
                    )}

                    {canMarkDone && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setReviewModal({ open: true, type: 'approve' })}
                          className="h-8 px-4 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <ThumbsUp size={12} strokeWidth={3} /> Approve
                        </button>
                        <button
                          onClick={() => setReviewModal({ open: true, type: 'request_changes' })}
                          className="h-8 px-4 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-200 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <CornerUpLeft size={12} strokeWidth={3} /> Revision
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Task Breakdown</h3>
                {canEdit && (
                  <button
                    onClick={() => setAddGroupModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all rounded-full text-[10px] font-bold border border-primary/10"
                  >
                    <Plus size={12} /> Add Task
                  </button>
                )}
              </div>

              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 py-2.5 px-4 bg-slate-50/50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                  <div className="w-8" /> {/* Grip Spacer */}
                  <div className="w-6" /> {/* Index Spacer */}
                  <span className="flex-1 ml-2">Task Description</span>
                  <div className="flex items-center justify-end gap-6">
                    <span className="w-[160px] text-right">Created At</span>
                    <span className="w-[160px] text-right">Updated At</span>
                    <span className="w-[48px] text-center">Status</span>
                    <span className="w-[28px]"></span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100/50">
                  <SortableContext items={taskGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                    {taskGroups.map((group, idx) => (
                      <SortableGroup
                        key={group.id}
                        group={{
                          ...group,
                          onEdit: (g) => { setEditItemData({ ...g, type: 'group' }); setAddGroupModalOpen(true); },
                          items: group.items.map(item => ({
                            ...item,
                            onEdit: (i) => { setEditItemData({ ...i, type: 'subtask' }); setAddGroupModalOpen(true); }
                          }))
                        }}
                        index={idx}
                        expanded={expandedGroups.includes(group.id)}
                        onToggle={(id) => setExpandedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        onAddItem={(id) => { setAddingToGroupId(id); setAddGroupModalOpen(true); }}
                        isLast={idx === taskGroups.length - 1}
                        onToggleGroup={handleToggleGroupStatus}
                        canEdit={canEdit}
                        onDeleteGroup={handleDeleteGroup}
                        onDeleteSubtask={handleDeleteSubtask}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>

              {canEdit && (
                <div className="py-2.5 rounded-[12px] border border-dashed border-slate-200/50 bg-slate-50/20 flex items-center justify-center gap-2.5 text-slate-300 transition-all">
                  <Share2 size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Drag and reorder any group or row</span>
                </div>
              )}

              {/* Activity / Feedback Section */}
              <div className="mt-8 flex flex-col gap-5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <History size={16} className="text-indigo-500" /> Activity & Feedback
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{comments.length} Comments</span>
                </div>

                <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 overflow-hidden">
                  <div className="flex flex-col gap-6">
                    {commentsLoading ? (
                      <div className="flex flex-col gap-4">
                        {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: '16px' }} />)}
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="py-10 flex flex-col items-center justify-center gap-3 opacity-30">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                          <MessageCircle size={32} className="text-slate-400" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">No feedback yet</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex gap-4 group animate-in slide-in-from-bottom-2 duration-300">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800, fontSize: 11, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                              {comment.author?.full_name?.charAt(0) || 'U'}
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-bold text-slate-900">{comment.author?.full_name}</span>
                                <span className="text-[9px] font-bold text-slate-400 opacity-60">
                                  {new Date(comment.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })} • {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className={`relative text-xs leading-relaxed p-3.5 rounded-2xl rounded-tl-none border transition-all duration-500 ${comment.message.includes('Approved') ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' :
                                comment.message.includes('Changes Requested') ? (comment.is_resolved ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-red-50/50 border-red-100 text-red-800') :
                                  'bg-slate-50/80 border-slate-100 text-slate-600'
                                }`}>
                                {comment.message.includes('**') ? (
                                  <div dangerouslySetInnerHTML={{ __html: comment.message.replace(/\*\*(.*?)\*\*/g, '<b class="font-black uppercase tracking-tight">$1</b>') }} />
                                ) : comment.message}

                                {comment.message.includes('Changes Requested') && (
                                  <button
                                    disabled={!isAssignee || toggleCommentResolution.isPending}
                                    onClick={() => toggleCommentResolution.mutate({ commentId: comment.id, isResolved: !comment.is_resolved, taskId: activeTask.id })}
                                    className={`absolute -right-2 -top-3 h-6 px-2.5 rounded-full flex items-center gap-1.5 border transition-all shadow-md group/tick ${comment.is_resolved
                                      ? 'bg-emerald-500 text-white border-emerald-600 scale-105'
                                      : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-600 hover:border-emerald-200 hover:scale-105'
                                      } ${!isAssignee ? 'cursor-default' : 'cursor-pointer active:scale-95'}`}
                                  >
                                    <span className="text-[9px] font-black uppercase tracking-widest">{comment.is_resolved ? 'Fixed' : 'Done'}</span>
                                    <Check size={10} strokeWidth={4} className={comment.is_resolved ? 'animate-in zoom-in duration-300' : 'group-hover/tick:scale-110 transition-transform'} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment Input */}
                    <div className="mt-2 pt-6 border-t border-slate-50 flex items-start gap-4">
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800, fontSize: 11 }}>
                        {(profile?.full_name || 'U').charAt(0)}
                      </Avatar>
                      <div className="flex-1 relative group">
                        <textarea
                          placeholder="Type a message or provide feedback..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 pr-14 text-xs font-medium placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none min-h-[48px] shadow-inner"
                          rows={1}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (e.target.value.trim()) {
                                addCommentMutation.mutate({ taskId: activeTask.id, authorId: currentUserId, message: e.target.value });
                                e.target.value = '';
                              }
                            }
                          }}
                        />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-110 transition-all active:scale-95 disabled:opacity-50">
                          <SendHorizonal size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Review Dialog */}
        <Dialog
          open={reviewModal.open}
          onClose={() => setReviewModal({ open: false, type: 'approve' })}
          disablePortal
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '28px',
              p: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#FFFFFF'
            }
          }}
          TransitionProps={{
            onEnter: (node) => {
              node.style.transformOrigin = 'center center';
            }
          }}
          sx={{
            backdropFilter: 'blur(8px)',
            '& .MuiDialog-paper': {
              animation: 'modalScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }
          }}
        >
          <div className="flex flex-col">
            {/* Header */}
            <div className="p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${reviewModal.type === 'approve'
                  ? 'bg-emerald-50 text-emerald-500 border border-emerald-100 shadow-sm'
                  : 'bg-[#FFF4EC] text-[#FF8A00] border border-[#FFE1CC] shadow-sm'
                  }`}>
                  {reviewModal.type === 'approve' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-lg font-black text-[#111827] tracking-tight leading-tight">
                    {reviewModal.type === 'approve' ? 'Approve Task' : 'Revision Required'}
                  </h3>
                  <p className="text-[11px] font-bold text-[#6B7280]">
                    {reviewModal.type === 'approve'
                      ? 'Finalize and mark this task as completed.'
                      : 'Please mention the required changes before resubmission.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewModal({ open: false, type: 'approve' })}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-100"
              >
                <Plus size={18} className="rotate-45" />
              </button>
            </div>

            <div className="h-px w-full bg-slate-100 mx-auto"></div>

            {/* Main Content */}
            <div className="p-8 pt-6">
              <div className="flex items-center justify-between mb-2 px-1">
                <label className="text-[10px] font-black text-[#111827] uppercase tracking-widest flex items-center gap-1">
                  {reviewModal.type === 'approve' ? 'Final Feedback' : 'Describe the required changes'}
                  <span className={reviewModal.type === 'approve' ? 'text-slate-300' : 'text-[#FF3D3D]'}>*</span>
                </label>
                {reviewNote.length > 0 && (
                  <span className="text-[9px] font-bold text-slate-400 tracking-tighter">
                    {reviewNote.length} / 500 characters
                  </span>
                )}
              </div>

              <div className="relative group">
                <textarea
                  className={`w-full bg-[#FAFBFF] border border-slate-100 rounded-2xl p-5 text-xs font-medium placeholder:text-slate-400 transition-all duration-300 resize-none min-h-[160px] shadow-inner ${reviewModal.type === 'approve'
                    ? 'focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/5'
                    : 'focus:border-[#FF8A00] focus:ring-4 focus:ring-[#FF8A00]/5'
                    }`}
                  autoFocus
                  maxLength={500}
                  placeholder={reviewModal.type === 'approve'
                    ? "Mention any final thoughts or appreciation..."
                    : "Mention required updates, fixes, or feedback..."}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />

                {/* Floating Particles/Dots Decoration */}
                <div className="absolute -top-3 -right-3 pointer-events-none opacity-40">
                  <div className={`w-2 h-2 rounded-full absolute top-0 right-0 ${reviewModal.type === 'approve' ? 'bg-emerald-300' : 'bg-[#FF8A00] animate-pulse'}`}></div>
                  <div className={`w-1.5 h-1.5 rounded-full absolute top-4 right-1 ${reviewModal.type === 'approve' ? 'bg-indigo-300' : 'bg-[#FF3D3D]'}`}></div>
                </div>
              </div>

              <p className="mt-3 text-[10px] font-bold text-slate-400 px-1 leading-relaxed">
                {reviewModal.type === 'approve'
                  ? 'The assignee will be notified of the completion.'
                  : 'Specify clear, actionable feedback to avoid multiple revision loops.'}
              </p>
            </div>

            {/* Footer Actions */}
            <div className="px-8 pb-8 flex gap-4">
              <button
                disabled={updateTaskMutation.isPending || markAsDoneMutation.isPending || addCommentMutation.isPending}
                onClick={() => setReviewModal({ open: false, type: 'approve' })}
                className="flex-1 h-12 rounded-2xl border border-slate-100 text-[11px] font-black uppercase tracking-widest text-[#6B7280] hover:text-[#111827] hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                disabled={
                  (reviewModal.type === 'request_changes' && !reviewNote.trim()) ||
                  updateTaskMutation.isPending ||
                  markAsDoneMutation.isPending ||
                  addCommentMutation.isPending
                }
                className={`flex-[1.8] h-12 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale group ${reviewModal.type === 'approve'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-200'
                  : 'bg-gradient-to-r from-[#FF8A00] to-[#FF3D3D] shadow-orange-200'
                  }`}
              >
                {(updateTaskMutation.isPending || markAsDoneMutation.isPending || addCommentMutation.isPending) ? (
                  <>
                    <CircularProgress size={16} color="inherit" /> Processing...
                  </>
                ) : reviewModal.type === 'approve' ? (
                  <>
                    <ThumbsUp size={16} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" /> Confirm Approval
                  </>
                ) : (
                  <>
                    <SendHorizonal size={16} strokeWidth={2.5} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Send for Revision
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog>
      </motion.div>

      <AddTaskModal
        open={isAddGroupModalOpen}
        onClose={() => { setAddGroupModalOpen(false); setAddingToGroupId(null); setEditItemData(null); }}
        onCreate={handleCreateGroupOrItem}
        title={editItemData ? (editItemData.type === 'group' ? "Edit Task Group" : "Edit Subtask") : addingToGroupId ? "Add Subtask" : "Add Task Group"}
        initialData={editItemData}
        subtitle={addingToGroupId ? "Add a specific item to this group breakdown." : "Create a clean task group inside this project."}
        showDueDate={!addingToGroupId}
      />
    </DndContext>
  );
};

// --- View 1: Task Grid ---
const TaskGrid = ({ tasks, onTaskClick, onTaskMenuClick, currentUserId, onSubmitReview, onMarkDone }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6"
    >
      {tasks.map((task) => {
        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
        const isAssigner = task.assigned_by === currentUserId;
        const isAssignee = task.assigned_to === currentUserId;
        return (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            className={`rounded-[24px] p-5 border transition-all cursor-pointer group relative flex flex-col h-full ${task.status === 'done'
              ? 'bg-emerald-100/50 border-emerald-200 shadow-sm shadow-emerald-50'
              : 'bg-white border-slate-100 hover:border-primary/20 hover:shadow-premium'
              }`}
          >
            {/* Top Header: User Info & Status */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2.5">
                <Avatar
                  sx={{
                    width: 32, height: 32,
                    fontSize: 12, fontWeight: 800,
                    bgcolor: isAssignee ? 'var(--emerald-50)' : 'var(--primary-light)',
                    color: isAssignee ? 'var(--emerald-600)' : 'var(--primary)',
                    borderRadius: '10px'
                  }}
                >
                  {(isAssignee ? task.assignedByName : task.assignedToName)?.charAt(0)}
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] font-black text-slate-900 leading-tight uppercase tracking-tight truncate whitespace-nowrap">
                    {isAssignee ? task.assignedByName : task.assignedToName}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                    {isAssignee ? 'Assigner' : task.departmentName}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                <IconButton
                  size="small"
                  className="text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskMenuClick(e.currentTarget, task);
                  }}
                >
                  <MoreVertical size={16} />
                </IconButton>
                <StatusChip status={task.status} />
              </div>
            </div>

            {/* Separator */}
            <div className="h-px bg-slate-50 w-full mb-4" />

            {/* Priority Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${task.priority === 'High' ? 'bg-red-50 text-red-500' :
              task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-primary-light text-primary'
              }`}>
              {task.priority === 'High' ? <AlertCircle size={20} /> :
                task.priority === 'Medium' ? <Briefcase size={20} /> : <CheckCircle size={20} />}
            </div>

            {/* Title & Deadline */}
            <h3 className="text-[15px] font-black text-slate-900 mb-1 leading-[1.2] group-hover:text-primary transition-colors tracking-tight">
              {task.title}
            </h3>

            <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-slate-400">
              <Calendar size={13} className="text-slate-300" />
              <span>
                {task.deadline
                  ? `Due ${new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : 'No deadline'}
              </span>
              {isOverdue && <span className="text-red-400">· Overdue</span>}
            </div>

            {/* Priority Badge */}
            <div className="mb-5">
              <PriorityBadge priority={task.priority} />
            </div>

            {/* Progress Section (Pinned to Bottom) */}
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                  Progress
                </span>
                <span className="text-[10px] font-black text-slate-900">{task.progress}%</span>
              </div>
              <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(task.progress, task.status)}`}
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Workflow Action (Optional Footer Space) */}
            {(isAssignee && task.status === 'in_progress') || (isAssigner && task.status === 'review') ? (
              <div className="mt-5 flex flex-col gap-2">
                {isAssignee && task.status === 'in_progress' && (
                  <button
                    onClick={e => { e.stopPropagation(); onSubmitReview(task); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-100/50"
                  >
                    <SendHorizonal size={12} /> Submit for Review
                  </button>
                )}
                {isAssigner && task.status === 'review' && (
                  <button
                    onClick={e => { e.stopPropagation(); onMarkDone(task); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl transition-all border border-emerald-100/50"
                  >
                    <ThumbsUp size={12} /> Approve & Done
                  </button>
                )}
              </div>
            ) : null}
            {task.status === 'review' && !isAssigner && (
              <p className="text-center text-[9px] text-amber-500 font-bold">⏳ In Review</p>
            )}
          </div>
        );
      })}
    </motion.div>
  );
};

// --- View 2: Compact List ---
const TaskCompactList = ({ tasks, onTaskClick, onTaskMenuClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-1.5"
    >
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onTaskClick(task)}
          className="bg-white rounded-xl py-2.5 px-5 border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${task.priority === 'High' ? 'bg-red-500' :
              task.priority === 'Medium' ? 'bg-amber-500' : 'bg-primary'
              }`} />
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
              {task.title}
            </h3>
            {task.project_name && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
                {task.project_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-bold text-slate-400">
              {task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No date'}
            </span>
            <StatusChip status={task.status} />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onTaskMenuClick(e.currentTarget, task);
              }}
            >
              <MoreVertical size={16} className="text-slate-300" />
            </IconButton>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// --- View 3: Detailed List ---
const TaskDetailedList = ({ tasks, onTaskClick, onTaskMenuClick, currentUserId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-3"
    >
      {tasks.map((task) => {
        const isAssignee = task.assigned_to === currentUserId;
        return (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            className={`rounded-[24px] p-6 border transition-all cursor-pointer group flex items-center gap-8 ${task.status === 'done'
              ? 'bg-emerald-100/40 border-emerald-200 shadow-sm shadow-emerald-50'
              : 'bg-white border-slate-100 hover:border-primary/20 hover:shadow-lg'
              }`}
          >
            <div className="flex items-center gap-4 w-[30%]">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${task.priority === 'High' ? 'bg-red-50 text-red-500' :
                task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-primary-light text-primary'
                }`}>
                {task.priority === 'High' ? <AlertCircle size={20} /> :
                  task.priority === 'Medium' ? <Briefcase size={20} /> : <CheckCircle size={20} />}
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                  {task.title}
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {task.project_name || 'General Task'}
                </span>
              </div>
            </div>

            <div className="flex flex-col w-32">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Date</span>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Calendar size={14} className="text-slate-300" />
                {task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                <span className="text-[9px] font-bold text-slate-900">{task.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(task.progress, task.status)}`}
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center gap-6 w-48 justify-end">
              <div className="flex items-center gap-2">
                <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 800, bgcolor: 'var(--slate-50)', color: 'var(--slate-400)' }}>
                  {(isAssignee ? task.assignedByName : task.assignedToName)?.charAt(0)}
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-900">{(isAssignee ? task.assignedByName : task.assignedToName)}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{isAssignee ? 'Assigner' : 'Assignee'}</span>
                </div>
              </div>
              <StatusChip status={task.status} />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskMenuClick(e.currentTarget, task);
                }}
              >
                <MoreVertical size={18} className="text-slate-300" />
              </IconButton>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};

// --- Loading Skeleton ---
const TaskSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="bg-white rounded-[32px] p-8 border border-slate-100">
        <Skeleton variant="rounded" width={56} height={56} sx={{ borderRadius: 3, mb: 3 }} />
        <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="50%" height={16} sx={{ mb: 4 }} />
        <Skeleton variant="rounded" height={4} />
      </div>
    ))}
  </div>
);

const MyTasks = () => {
  const { id: taskId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeTask, setActiveTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [viewAnchor, setViewAnchor] = useState(null);
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || 'all');
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [taskMenu, setTaskMenu] = useState({ anchor: null, task: null });
  const [editingTask, setEditingTask] = useState(null);
  const [taskTab, setTaskTab] = useState('assigned_to');

  const { data: rawTasks = [], isLoading, error: fetchError } = useMyTasks(user?.id);
  const tasks = useMemo(() => {
    if (fetchError) return [];

    const statusOrderMap = {
      in_progress: 0,
      review: 0,
      pending: 1,
      done: 2
    };

    return rawTasks
      .sort((a, b) => {
        const orderA = statusOrderMap[a.status] ?? 3;
        const orderB = statusOrderMap[b.status] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id);
      })
      .map(normalizeTask);
  }, [rawTasks, fetchError]);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const submitReview = useSubmitForReview();
  const markDone = useMarkAsDone();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('tasks_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const view = taskId ? 'workspace' : 'grid';

  useEffect(() => {
    if (taskId) {
      const task = tasks.find(t => String(t.id) === String(taskId));
      if (task) {
        setActiveTask(task);
        localStorage.setItem(`breadcrumb_label_${task.id}`, task.title);
        document.title = `${task.title} | EMS Portal`;
        window.dispatchEvent(new Event('storage'));
      } else if (!isLoading && tasks.length > 0) {
        navigate('/my-tasks', { replace: true });
      }
    } else {
      setActiveTask(null);
    }
  }, [taskId, tasks, isLoading, navigate]);

  const handleCreateTask = async (payload) => {
    try {
      if (payload.id) {
        await updateTask.mutateAsync({
          taskId: payload.id,
          updates: {
            title: payload.title,
            project_name: payload.projectName,
            assigned_to: payload.assignedTo,
            deadline: payload.deadline,
            priority: payload.priority,
            description: payload.description
          },
          actorId: user.id,
          actionType: 'updated'
        });
        setEditingTask(null);
      } else {
        await createTask.mutateAsync(payload);
        if (payload.assignedTo !== user.id) {
          try {
            await notificationService.notifyUser?.(
              payload.assignedTo,
              'New Task Assigned',
              `${profile?.full_name || 'Someone'} assigned you: "${payload.title}"`,
              'task',
              '/my-tasks'
            );
          } catch (_) { }
        }
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Task action failed:', err);
    }
  };

  const handleDeleteTask = async (task) => {
    setTaskMenu({ anchor: null, task: null });
    const { default: Swal } = await import('sweetalert2');
    const result = await Swal.fire({
      title: 'Delete Task?',
      text: `Are you sure you want to delete "${task.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Yes, delete it'
    });
    if (result.isConfirmed) {
      try {
        await deleteTask.mutateAsync(task.id);
      } catch (err) {
        Swal.fire('Error', err.message || 'Failed to delete task', 'error');
      }
    }
  };

  const handleSubmitForReview = async (task) => {
    await submitReview.mutateAsync({ taskId: task.id, actorId: user.id, oldStatus: task.status });
    // Notify the assigner
    if (task.assigned_by && task.assigned_by !== user.id) {
      try {
        await notificationService.notifyUser?.(
          task.assigned_by,
          'Task Ready for Review',
          `${profile?.full_name} completed "${task.title}" — please review.`,
          'task',
          '/my-tasks'
        );
      } catch (_) { /* non-critical */ }
    }
  };

  const handleMarkDone = (task) =>
    markDone.mutateAsync({ taskId: task.id, actorId: user.id, oldStatus: task.status });

  const handleTaskClick = (task) => {
    navigate(`/my-tasks/${task.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!task.is_acknowledged && task.assigned_to === user?.id) {
      taskService.acknowledgeTask(task.id, user.id);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.project_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = taskTab === 'assigned_to' ? t.assigned_to === user?.id : t.assigned_by === user?.id;
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = t.status === 'pending';
    else if (statusFilter === 'in_progress') matchesStatus = t.status === 'in_progress' || t.status === 'review';
    else if (statusFilter === 'completed') matchesStatus = t.status === 'done';
    return matchesSearch && matchesTab && matchesStatus;
  });

  return (
    <div className="pb-20">
      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PageHeader title="Tasks Center" subtitle="Track and manage your professional goals.">
              <div className="flex flex-wrap gap-4">
                <div className="relative w-full sm:w-80">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full h-12 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl text-sm font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => setViewAnchor(e.currentTarget)}
                    className="h-12 px-5 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    {viewMode === 'grid' ? <LayoutGrid size={18} className="text-primary" /> :
                      viewMode === 'compact' ? <List size={18} className="text-primary" /> :
                        <Columns size={18} className="text-primary" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {viewMode === 'grid' ? 'Grid View' : viewMode === 'compact' ? 'Compact' : 'Detailed'}
                    </span>
                    <ChevronDownIcon size={14} className="text-slate-300" />
                  </button>

                  <Menu
                    anchorEl={viewAnchor}
                    open={Boolean(viewAnchor)}
                    onClose={() => setViewAnchor(null)}
                    slotProps={{
                      paper: {
                        sx: { mt: 1, borderRadius: '20px', p: 1, width: 180, boxShadow: 'var(--shadow-premium)', border: '1px solid var(--border-light)' }
                      }
                    }}
                  >
                    {[
                      { id: 'grid', label: 'Grid View', icon: LayoutGrid },
                      { id: 'compact', label: 'Compact View', icon: List },
                      { id: 'detailed', label: 'Detailed View', icon: Columns },
                    ].map((item) => (
                      <MenuItem
                        key={item.id}
                        onClick={() => { setViewMode(item.id); setViewAnchor(null); }}
                        sx={{
                          borderRadius: '12px', mb: 0.5, py: 1, px: 1.5,
                          bgcolor: viewMode === item.id ? 'var(--primary-light)' : 'transparent',
                          '&:hover': { bgcolor: 'var(--slate-50)' }
                        }}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <item.icon size={16} className={viewMode === item.id ? 'text-primary' : 'text-slate-400'} />
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${viewMode === item.id ? 'text-primary' : 'text-slate-600'}`}>
                            {item.label}
                          </span>
                        </div>
                      </MenuItem>
                    ))}
                  </Menu>
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => setFilterAnchor(e.currentTarget)}
                    className="h-12 px-5 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <Filter size={18} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {statusFilter === 'all' ? 'All Tasks' :
                        statusFilter === 'pending' ? 'Pending Tasks' :
                          statusFilter === 'in_progress' ? 'In Progress Tasks' :
                            'Completed Tasks'}
                    </span>
                    <ChevronDownIcon size={14} className="text-slate-300" />
                  </button>

                  <Menu
                    anchorEl={filterAnchor}
                    open={Boolean(filterAnchor)}
                    onClose={() => setFilterAnchor(null)}
                    slotProps={{
                      paper: {
                        sx: { mt: 1, borderRadius: '20px', p: 1, width: 180, boxShadow: 'var(--shadow-premium)', border: '1px solid var(--border-light)' }
                      }
                    }}
                  >
                    {[
                      { id: 'all', label: 'All Tasks' },
                      { id: 'pending', label: 'Pending Tasks' },
                      { id: 'in_progress', label: 'In Progress Tasks' },
                      { id: 'completed', label: 'Completed Tasks' },
                    ].map((item) => (
                      <MenuItem
                        key={item.id}
                        onClick={() => { setStatusFilter(item.id); setFilterAnchor(null); }}
                        sx={{
                          borderRadius: '12px', mb: 0.5, py: 1, px: 1.5,
                          bgcolor: statusFilter === item.id ? 'var(--primary-light)' : 'transparent',
                          '&:hover': { bgcolor: 'var(--slate-50)' }
                        }}
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === item.id ? 'text-primary' : 'text-slate-600'}`}>
                          {item.label}
                        </span>
                      </MenuItem>
                    ))}
                  </Menu>
                </div>

                <button
                  onClick={() => setModalOpen(true)}
                  className="h-12 px-8 rounded-2xl flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                  style={{ backgroundColor: '#635bff', color: '#ffffff', border: 'none', boxShadow: '0 14px 28px rgba(99,91,255,0.26)' }}
                >
                  <Plus size={20} strokeWidth={3} />
                  <span className="text-xs font-black uppercase tracking-widest">New Task</span>
                </button>
              </div>
            </PageHeader>

            <div className="max-w-[1320px] mx-auto px-6">
              <div className="flex gap-2 p-1.5 bg-slate-100/50 backdrop-blur-md rounded-[24px] border border-slate-100 w-fit mb-12 shadow-inner">
                <button
                  onClick={() => setTaskTab('assigned_to')}
                  className={`px-8 py-3.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${taskTab === 'assigned_to' ? 'bg-white text-slate-900 shadow-lg shadow-slate-200/50 scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Assigned to me <span className="ml-2 opacity-50">{tasks.filter(t => t.assigned_to === user?.id).length}</span>
                </button>
                <button
                  onClick={() => setTaskTab('assigned_by')}
                  className={`px-8 py-3.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${taskTab === 'assigned_by' ? 'bg-white text-slate-900 shadow-lg shadow-slate-200/50 scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Assigned by me <span className="ml-2 opacity-50">{tasks.filter(t => t.assigned_by === user?.id).length}</span>
                </button>
              </div>

              {isLoading ? <TaskSkeleton /> : filteredTasks.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 border border-slate-100">
                    <Layout size={40} className="text-slate-200" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No tasks found</h3>
                  <p className="text-slate-400 max-w-xs text-sm">
                    {searchQuery ? `We couldn't find any tasks matching "${searchQuery}"` : "You're all caught up!"}
                  </p>
                </div>
              ) : (
                <>
                  {viewMode === 'grid' && (
                    <TaskGrid tasks={filteredTasks} onTaskClick={handleTaskClick} onTaskMenuClick={(anchor, task) => setTaskMenu({ anchor, task })} currentUserId={user?.id} onSubmitReview={handleSubmitForReview} onMarkDone={handleMarkDone} />
                  )}
                  {viewMode === 'compact' && <TaskCompactList tasks={filteredTasks} onTaskClick={handleTaskClick} onTaskMenuClick={(anchor, task) => setTaskMenu({ anchor, task })} />}
                  {viewMode === 'detailed' && <TaskDetailedList tasks={filteredTasks} onTaskClick={handleTaskClick} onTaskMenuClick={(anchor, task) => setTaskMenu({ anchor, task })} currentUserId={user?.id} />}
                </>
              )}
            </div>

            <Menu
              anchorEl={taskMenu.anchor}
              open={Boolean(taskMenu.anchor)}
              onClose={() => setTaskMenu({ anchor: null, task: null })}
              slotProps={{
                paper: { sx: { borderRadius: '20px', p: 1, width: 200, boxShadow: 'var(--shadow-premium)', border: '1px solid var(--border-light)' } }
              }}
            >
              <MenuItem onClick={() => { handleTaskClick(taskMenu.task); setTaskMenu({ anchor: null, task: null }); }} sx={{ borderRadius: '12px', mb: 0.5, py: 1.25, px: 2 }}>
                <div className="flex items-center gap-3 w-full">
                  <Layout size={16} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Open Workspace</span>
                </div>
              </MenuItem>
              {taskMenu.task?.assigned_by === user?.id && (
                <>
                  <div className="h-px bg-slate-50 my-1 mx-2" />
                  <MenuItem onClick={() => { setEditingTask(taskMenu.task); setModalOpen(true); setTaskMenu({ anchor: null, task: null }); }} sx={{ borderRadius: '12px', mb: 0.5, py: 1.25, px: 2 }}>
                    <div className="flex items-center gap-3 w-full">
                      <Zap size={16} className="text-indigo-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Edit Task</span>
                    </div>
                  </MenuItem>
                  <MenuItem onClick={() => handleDeleteTask(taskMenu.task)} sx={{ borderRadius: '12px', py: 1.25, px: 2, '&:hover': { bgcolor: 'red.50' } }}>
                    <div className="flex items-center gap-3 w-full">
                      <Trash2 size={16} className="text-red-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Delete Task</span>
                    </div>
                  </MenuItem>
                </>
              )}
            </Menu>
          </motion.div>
        ) : activeTask ? (
          <TaskWorkspace activeTask={activeTask} allTasks={tasks} onTaskSelect={handleTaskClick} onBack={() => navigate('/my-tasks')} onAddTask={() => setModalOpen(true)} currentUserId={user?.id} onSubmitReview={handleSubmitForReview} onMarkDone={handleMarkDone} />
        ) : (
          <div className="flex justify-center items-center min-h-[400px]">
            <CircularProgress sx={{ color: 'var(--primary)' }} />
          </div>
        )}
      </AnimatePresence>
      <CreateTaskModal open={isModalOpen} onClose={() => { setModalOpen(false); setEditingTask(null); }} onCreate={handleCreateTask} initialData={editingTask} isSubmitting={createTask.isPending || updateTask.isPending} />
    </div>
  );
};

export default MyTasks;