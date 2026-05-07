import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Grid, List, Plus, Filter, MoreVertical, Calendar,
  ChevronRight, ChevronDown, CheckCircle2, Clock, AlertCircle,
  ArrowLeft, Edit3, MessageSquare, Paperclip, Share2, GripVertical,
  CheckCircle, Briefcase, ChevronUp, ChevronDown as ChevronDownIcon, ChevronLeft, Layout, Target,
  Zap, Award, Check, PlayCircle
} from "lucide-react";
import { Box, Chip, Avatar, LinearProgress, IconButton, Tooltip, Collapse, Menu, MenuItem, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import PageHeader from '../components/PageHeader';
import { MOCK_TASKS, MOCK_EMPLOYEES } from '../utils/mockTasks';
import CreateTaskModal from "../components/CreateTaskModal";
import AddTaskModal from "../components/AddTaskModal";

// --- Sub-components ---

const PriorityBadge = ({ priority }) => {
  const styles = {
    High: "bg-red-50 text-red-500 border-red-100",
    Medium: "bg-amber-50 text-amber-600 border-amber-100",
    Low: "bg-emerald-50 text-emerald-600 border-emerald-100",
    Critical: "bg-red-600 text-white border-red-700"
  };
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${styles[priority] || styles.Low}`}>
      {priority}
    </span>
  );
};

const StatusChip = ({ status }) => {
  const styles = {
    "In Progress": "bg-indigo-50 text-indigo-600 border-indigo-100",
    "Done": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Pending": "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${styles[status] || styles.Pending}`}>
      {status}
    </span>
  );
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

const SortableSubtaskItem = ({ item, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
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
      <div {...attributes} {...listeners} className="p-1 text-slate-200 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 transition-opacity">
        <GripVertical size={14} />
      </div>

      <span className={`text-[12px] font-medium flex-1 tracking-tight transition-colors ${item.isCompleted ? 'text-emerald-700' : 'text-slate-700'
        }`}>
        {item.title}
      </span>

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300 w-[80px]">
          <Calendar size={10} /> {item.date}
        </div>

        <div className="w-[48px] flex justify-center">
          <button
            onClick={() => onToggle(item.id)}
            className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all duration-300 ${item.isCompleted
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
              : 'bg-white border-2 border-slate-200 text-transparent hover:border-emerald-500 hover:bg-emerald-50'
              }`}
          >
            <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${item.isCompleted ? 'scale-100' : 'scale-0'}`} />
          </button>
        </div>

        <div className="w-[28px]">
          <IconButton size="small" className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5">
            <MoreVertical size={14} className="text-slate-300" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

const SortableGroup = ({ group, index, expanded, onToggle, onAddItem, isLast, onToggleGroup }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1
  };

  const isGroupCompleted = group.items.every(i => i.isCompleted);

  return (
    <div ref={setNodeRef} style={style} className={`transition-all bg-white ${!isLast ? 'border-b border-slate-100/50' : ''}`}>
      <div className="py-2.5 px-4 flex items-center justify-center bg-slate-50/30 group/header">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div {...attributes} {...listeners} className="p-1 text-slate-200 cursor-grab active:cursor-grabbing opacity-0 group-hover/header:opacity-100 transition-opacity">
              <GripVertical size={14} />
            </div>
            <div className="w-6 h-6 rounded bg-white text-primary border border-primary/10 flex items-center justify-center font-bold text-[10px]">
              {index + 1}
            </div>
            <h4 className="text-[12px] font-bold text-slate-900 tracking-tight">{group.title}</h4>
          </div>

          <div className="flex items-center justify-end">
            <div className="flex items-center gap-1 mr-4">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.1em] px-2">{group.items.length} ITEMS</span>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onAddItem(group.id); }}
                className="w-6 h-6 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Plus size={14} />
              </IconButton>
            </div>

            <div className="w-[48px] flex justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleGroup(group.id, !isGroupCompleted); }}
                className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all duration-300 ${isGroupCompleted
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                  : 'bg-white border-2 border-slate-200 text-transparent hover:border-emerald-500 hover:bg-emerald-50'
                  }`}
              >
                <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${isGroupCompleted ? 'scale-100' : 'scale-0'}`} />
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
        <div className="bg-white pl-8">
          <SortableContext items={group.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {group.items.map(item => (
              <SortableSubtaskItem key={item.id} item={item} onToggle={(id) => onToggleGroup(group.id, id)} />
            ))}
          </SortableContext>
        </div>
      </Collapse>
    </div>
  );
};

// --- Main Components ---

const TaskWorkspace = ({ activeTask, allTasks, onTaskSelect, onBack, onAddTask }) => {
  const [tasks, setTasks] = useState(allTasks);
  const [taskGroups, setTaskGroups] = useState(activeTask.subtaskGroups || []);
  const [expandedGroups, setExpandedGroups] = useState(activeTask.subtaskGroups?.map(g => g.id) || []);
  const [switcherAnchor, setSwitcherAnchor] = useState(null);
  const [isAddGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState(null);

  const handleCreateGroupOrItem = (data) => {
    if (addingToGroupId) {
      const newItem = {
        id: `item-${Date.now()}`,
        title: data.name,
        date: data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : "No Date",
        isCompleted: data.status === 'Completed'
      };
      setTaskGroups(prev => prev.map(group => 
        group.id === addingToGroupId ? { ...group, items: [...group.items, newItem] } : group
      ));
      setAddingToGroupId(null);
      setAddGroupModalOpen(false);
    } else {
      const newGroup = {
        id: `group-${Date.now()}`,
        title: data.name,
        items: []
      };
      setTaskGroups(prev => [...prev, newGroup]);
      setExpandedGroups(prev => [...prev, newGroup.id]);
      setAddGroupModalOpen(false);
    }
  };

  useEffect(() => {
    setTaskGroups(activeTask.subtaskGroups || []);
    setExpandedGroups(activeTask.subtaskGroups?.map(g => g.id) || []);
  }, [activeTask]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggleGroupStatus = (groupId, itemIdOrStatus) => {
    setTaskGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        if (typeof itemIdOrStatus === 'string') {
          return {
            ...group,
            items: group.items.map(item =>
              item.id === itemIdOrStatus ? { ...item, isCompleted: !item.isCompleted } : item
            )
          };
        } else {
          return {
            ...group,
            items: group.items.map(item => ({ ...item, isCompleted: itemIdOrStatus }))
          };
        }
      }
      return group;
    }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (tasks.some(t => t.id === active.id)) {
      setTasks(prev => {
        const oldIndex = prev.findIndex(t => t.id === active.id);
        const newIndex = prev.findIndex(t => t.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }

    if (taskGroups.some(g => g.id === active.id)) {
      setTaskGroups(prev => {
        const oldIndex = prev.findIndex(g => g.id === active.id);
        const newIndex = prev.findIndex(g => g.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }

    taskGroups.forEach(group => {
      if (group.items.some(i => i.id === active.id)) {
        const updatedGroups = taskGroups.map(g => {
          if (g.id === group.id) {
            const oldIndex = g.items.findIndex(i => i.id === active.id);
            const newIndex = g.items.findIndex(i => i.id === over.id);
            if (newIndex !== -1) {
              return { ...g, items: arrayMove(g.items, oldIndex, newIndex) };
            }
          }
          return g;
        });
        setTaskGroups(updatedGroups);
      }
    });
  };

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
            PaperProps={{
              sx: { width: 240, mt: 0.5, borderRadius: '12px', p: 0.75, boxShadow: 'var(--shadow-premium)', border: '1px solid var(--border-light)' }
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
                value={activeTask.progress}
                size={52}
                thickness={5}
                sx={{
                  color: 'var(--primary)',
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
                <span className="text-[11px] font-bold text-slate-900">{activeTask.progress}%</span>
              </div>
            </div>
            <h4 className="text-[10px] font-bold text-slate-700 mb-0.5 tracking-tight">Workspace Progress</h4>
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-2">3 of 8 completed</p>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-success-light/30 text-success text-[7px] font-bold rounded-full border border-success/10 uppercase tracking-wider">
              <Zap size={8} fill="currentColor" /> On Track
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col gap-5 w-full">
          <div className="flex flex-col gap-4">
            {/* UNIFIED MINIMAL CHIP HEADER */}
            <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between gap-6">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none truncate">{activeTask.title}</h1>
                  <PriorityBadge priority={activeTask.priority} />
                </div>
              </div>

              {/* Vertical Dividers + Metadata Chips */}
              <div className="flex items-center gap-8 h-10 pr-2">
                {/* Assignee */}
                <div className="flex items-center gap-3">
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: 10 }}>{activeTask.assignedTo.charAt(0)}</Avatar>
                  <span className="text-[11px] font-bold text-slate-900">{activeTask.assignedTo}</span>
                </div>

                <div className="w-px h-6 bg-slate-100"></div>

                {/* Due Date */}
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-slate-400" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">{activeTask.deadline}</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-tighter">3D LEFT</span>
                  </div>
                </div>

                <div className="w-px h-6 bg-slate-100"></div>

                {/* Status */}
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-success bg-success-light/20">
                    <PlayCircle size={16} />
                  </div>
                  <span className="text-[11px] font-bold text-success whitespace-nowrap">In Progress</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Task Breakdown</h3>
                <button 
                  onClick={() => setAddGroupModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all rounded-full text-[10px] font-bold border border-primary/10"
                >
                  <Plus size={12} /> Add Task
                </button>
              </div>

              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 py-2.5 pl-20 pr-4 bg-slate-50/50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                  <span className="flex-1">Task Description</span>
                  <div className="flex items-center justify-end">
                    <span className="w-[80px]">Due Date</span>
                    <span className="w-[48px] text-center">Status</span>
                    <span className="w-[28px]"></span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100/50">
                  <SortableContext items={taskGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                    {taskGroups.map((group, idx) => (
                      <SortableGroup
                        key={group.id}
                        group={group}
                        index={idx}
                        expanded={expandedGroups.includes(group.id)}
                        onToggle={(id) => setExpandedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        onAddItem={(id) => { setAddingToGroupId(id); setAddGroupModalOpen(true); }}
                        isLast={idx === taskGroups.length - 1}
                        onToggleGroup={handleToggleGroupStatus}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>

              <div className="py-2.5 rounded-[12px] border border-dashed border-slate-200/50 bg-slate-50/20 flex items-center justify-center gap-2.5 text-slate-300 transition-all">
                <Share2 size={14} />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Drag and reorder any group or row</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <AddTaskModal
        open={isAddGroupModalOpen}
        onClose={() => { setAddGroupModalOpen(false); setAddingToGroupId(null); }}
        onCreate={handleCreateGroupOrItem}
        title={addingToGroupId ? "Add Subtask" : "Add Task Group"}
        subtitle={addingToGroupId ? "Add a specific item to this group breakdown." : "Create a clean task group inside this project."}
        showDueDate={!addingToGroupId}
      />
    </DndContext>
  );
};

// --- View 1: Task Grid ---
const TaskGrid = ({ tasks, onTaskClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onTaskClick(task)}
          className="bg-white rounded-[32px] p-8 border border-slate-100 hover:border-primary/20 hover:shadow-premium transition-all cursor-pointer group relative flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${task.priority === 'High' ? 'bg-red-50 text-red-500' :
              task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-primary-light text-primary'
              }`}>
              {task.priority === 'High' ? <AlertCircle size={24} /> :
                task.priority === 'Medium' ? <Briefcase size={24} /> : <CheckCircle size={24} />}
            </div>
            <IconButton size="small" className="text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical size={18} />
            </IconButton>
          </div>

          <h3 className="text-base font-bold text-slate-900 mb-2 leading-tight group-hover:text-primary transition-colors">
            {task.title}
          </h3>

          <div className="flex items-center gap-2 mb-5 text-[10px] font-medium text-slate-400">
            <Calendar size={12} />
            <span>Due {new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </div>

          <div className="mb-8">
            <PriorityBadge priority={task.priority} />
          </div>

          <div className="mt-auto">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Progress
              </span>
              <span className="text-[9px] font-bold text-slate-900">{task.progress}%</span>
            </div>
            <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${task.progress}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-8 flex justify-center border-t border-slate-50 pt-6">
            <StatusChip status={task.status} />
          </div>
        </div>
      ))}
    </motion.div>
  );
};

// --- Main Page Component ---
const MyTasks = () => {
  const [view, setView] = useState("grid"); // "grid" or "workspace"
  const [activeTask, setActiveTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const handleCreateTask = (newTaskData) => {
    const newTask = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      projectName: "New Project", // Default for now
      assignedTo: "Me",
      progress: 0,
      status: "Todo",
      priority: "Medium",
      subtaskGroups: []
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const handleTaskClick = (task) => {
    setActiveTask(task);
    setView("workspace");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setView("grid");
    setActiveTask(null);
  };

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pb-20">
      <AnimatePresence mode="wait">
        {view === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PageHeader title="Tasks Center" subtitle="Track and manage your professional goals.">
              <div className="flex flex-wrap gap-4">
                <div className="relative w-full sm:w-80">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full h-12 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl text-sm font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => setModalOpen(true)}
                  className="btn-ems btn-ems-primary h-12 rounded-2xl px-8 shadow-xl shadow-primary/20 text-xs font-bold"
                >
                  <Plus size={18} className="mr-1" /> New Task
                </button>
              </div>
            </PageHeader>

            <TaskGrid tasks={filteredTasks} onTaskClick={handleTaskClick} />
          </motion.div>
        ) : (
          <TaskWorkspace
            key="workspace"
            activeTask={activeTask}
            allTasks={tasks}
            onTaskSelect={(task) => setActiveTask(task)}
            onBack={handleBack}
            onAddTask={() => setModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <AddTaskModal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateTask}
      />
    </div>
  );
};

export default MyTasks;