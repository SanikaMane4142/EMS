import React, { useState, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Users, Briefcase, Filter, Search, Download, FileDown,
  AlertCircle, CheckCircle2, Clock, ThumbsUp, ChevronDown, ChevronUp,
  AlertTriangle, X, Eye, Calendar, ListTodo, History, Check, MessageCircle,
  ArrowLeft, Info, MessageSquare, ExternalLink, Activity, ChevronRight
} from "lucide-react";
import { Box, Chip, Avatar, Skeleton, Tooltip, Dialog, IconButton, CircularProgress } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { useAllTasks, useTaskComments, useTaskActivityLog, useTaskDetails, useTaskSubtasks, useUpdateTask, useAddComment } from '../hooks/useTasks';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import { notificationService } from '../services/notificationService';
import { normalizeTask, TASK_STATUS_STYLES } from '../utils/taskUtils';

// ── Constants ──
const INITIAL_LOAD_COUNT = 10;

const PRIORITY_COLORS = {
  Critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  High: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  Medium: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  Low: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
};

const AdminTaskView = () => {
  const navigate = useNavigate();
  const [filterDept, setFilterDept] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [performanceMetric, setPerformanceMetric] = useState("Pending");
  const [performanceTimeRange, setPerformanceTimeRange] = useState("This Week");

  // ── Review State ──
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [reviewModal, setReviewModal] = useState({ open: false, type: 'approve' });
  const [reviewNote, setReviewNote] = useState('');
  const updateTaskMutation = useUpdateTask();
  const addCommentMutation = useAddComment();

  // ── Real Data Hooks ──
  const { data: rawTasks = [], isLoading: tasksLoading, error: tasksError } = useAllTasks();
  const { data: employees = [], isLoading: empsLoading, error: empsError } = useEmployees();

  const { data: comments = [], isLoading: commentsLoading } = useTaskComments(selectedTask?.id);
  const { data: rawTaskDetails, isFetching: detailsFetching } = useTaskDetails(selectedTask?.id);
  const { data: rawSubtasks = [], isFetching: subtasksFetching } = useTaskSubtasks(selectedTask?.id);

  // Normalize the fresh details
  const taskDetails = useMemo(() => rawTaskDetails ? normalizeTask(rawTaskDetails) : null, [rawTaskDetails]);

  // The task to display in the modal: fresh details take precedence
  const activeTask = taskDetails || selectedTask;

  // Only show loading if we have absolutely no data yet and it's fetching
  const isActuallyLoading = (detailsFetching || subtasksFetching) && !activeTask?.subtaskGroups && !activeTask?.task_groups;

  // Normalize separate subtasks (fallback if main join fails for HR)
  const displaySubtasks = useMemo(() => {
    // 1. Prioritize raw subtasks from the dedicated fetch
    const source = (rawSubtasks && rawSubtasks.length > 0)
      ? rawSubtasks
      : (activeTask?.task_groups || activeTask?.subtaskGroups || []);

    if (!Array.isArray(source)) return [];

    return source.map(g => {
      // Handle both normalized and raw structures
      const groupTitle = g.title || "Section";
      const groupIsCompleted = g.isCompleted ?? g.is_completed ?? false;
      const subtasks = g.items || g.subtasks || [];

      return {
        ...g,
        title: groupTitle,
        isCompleted: groupIsCompleted,
        items: Array.isArray(subtasks) ? subtasks.map(s => ({
          ...s,
          isCompleted: s.isCompleted ?? s.is_completed ?? false,
          date: s.date || (s.due_date ? new Date(s.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'),
          updatedTime: s.updated_at ? new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        })).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id)) : []
      };
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id));
  }, [rawSubtasks, activeTask]);

  // ── Debug Logging ──
  React.useEffect(() => {
    if (rawTasks.length > 0) console.log('AdminTaskView: Tasks fetched successfully', rawTasks);
    if (tasksError) console.error('AdminTaskView: Tasks fetch error', tasksError);
  }, [rawTasks, tasksError]);

  // ── Normalization ──
  const tasks = useMemo(() => 
    rawTasks
      .map(normalizeTask)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id)), 
  [rawTasks]);

  // ── Stats Calculation (always from full set, before table filters) ──
  const stats = useMemo(() => taskService.computeStats(tasks), [tasks]);

  // ── Derived Data ──
  const depts = useMemo(() => {
    const d = new Set(["All"]);
    employees.forEach(emp => {
      if (emp.departments?.name) d.add(emp.departments.name);
    });
    return Array.from(d);
  }, [employees]);

  // ── Deadline helpers ──
  const getDeadlineInfo = (deadline, status) => {
    if (!deadline || status === 'done') return { type: 'none' };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dl = new Date(deadline);
    dl.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { type: 'overdue', label: `${Math.abs(diffDays)}d overdue`, color: 'red' };
    if (diffDays === 0) return { type: 'today', label: 'Due today', color: 'amber' };
    if (diffDays <= 2) return { type: 'soon', label: `${diffDays}d left`, color: 'orange' };
    return { type: 'safe', label: `${diffDays}d left`, color: 'slate' };
  };

  // ── Filtered Tasks ──
  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => {
      // Department filter
      const matchDept = filterDept === "All" || t.departmentName === filterDept;
      // Priority filter
      const matchPriority = filterPriority === "All" || t.priority === filterPriority;
      // Status card filter
      let matchStatus = true;
      if (activeStatusFilter === 'in_progress') matchStatus = t.status === 'in_progress';
      else if (activeStatusFilter === 'review') matchStatus = t.status === 'review';
      else if (activeStatusFilter === 'overdue') matchStatus = t.deadline && t.deadline < today && t.status !== 'done';
      else if (activeStatusFilter === 'total') matchStatus = true; // show all
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        t.title?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q) ||
        t.project_name?.toLowerCase().includes(q);
      return matchDept && matchPriority && matchStatus && matchSearch;
    });
  }, [tasks, filterDept, filterPriority, activeStatusFilter, searchQuery]);

  // ── Team Performance Calculation (Dynamic Analytics) ──
  const teamLoad = useMemo(() => {
    if (!tasks.length || !employees.length) return [];

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isInTimeRange = (dateStr, range) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const t = d.getTime();

      if (range === 'Today') return t >= startOfToday.getTime();
      if (range === 'This Week') {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        return t >= startOfWeek.getTime();
      }
      if (range === 'This Month') {
        const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
        return t >= startOfMonth.getTime();
      }
      if (range === 'Last 3 Months') {
        const ninetyDaysAgo = new Date(startOfToday);
        ninetyDaysAgo.setDate(startOfToday.getDate() - 90);
        return t >= ninetyDaysAgo.getTime();
      }
      return true;
    };

    const relevantEmps = filterDept === "All"
      ? employees
      : employees.filter(emp => emp.departments?.name === filterDept);

    return relevantEmps
      .map(emp => {
        const empTasks = tasks.filter(t => t.assigned_to === emp.id);

        // 1. Calculate count based on Metric + Time Range
        let metricCount = 0;
        if (performanceMetric === 'Total Tasks') {
          metricCount = empTasks.filter(t => isInTimeRange(t.created_at, performanceTimeRange)).length;
        } else if (performanceMetric === 'Overdue') {
          metricCount = empTasks.filter(t =>
            t.status !== 'done' &&
            t.deadline &&
            new Date(t.deadline) < startOfToday &&
            isInTimeRange(t.deadline, performanceTimeRange)
          ).length;
        } else {
          const statusMap = {
            'Pending': 'pending',
            'Completed': 'done',
            'In Review': 'review',
            'In Progress': 'in_progress'
          };
          const targetStatus = statusMap[performanceMetric];
          metricCount = empTasks.filter(t => {
            if (t.status !== targetStatus) return false;
            // Rule: Completed uses completed_at/updated_at, others use created_at
            const dateToCheck = targetStatus === 'done' ? (t.completed_at || t.updated_at) : t.created_at;
            return isInTimeRange(dateToCheck, performanceTimeRange);
          }).length;
        }

        // 2. Calculate productivity percentage (Completion Rate in period)
        const tasksInPeriod = empTasks.filter(t => isInTimeRange(t.created_at, performanceTimeRange));
        const completedInPeriod = tasksInPeriod.filter(t => t.status === 'done').length;
        const percentage = tasksInPeriod.length > 0
          ? Math.round((completedInPeriod / tasksInPeriod.length) * 100)
          : 0;

        return {
          id: emp.id,
          name: emp.full_name,
          count: metricCount,
          percentage: percentage,
          dept: emp.departments?.name || 'General',
        };
      })
      .filter(emp => emp.count > 0) // Only show employees with matching tasks
      .sort((a, b) => b.count - a.count);
  }, [employees, tasks, filterDept, performanceMetric, performanceTimeRange]);

  const displayedTeamLoad = showAllEmployees ? teamLoad : teamLoad.slice(0, INITIAL_LOAD_COUNT);
  const hasMoreEmployees = teamLoad.length > INITIAL_LOAD_COUNT;

  // ── Active filters count ──
  const activeFilterCount = [
    filterDept !== 'All',
    filterPriority !== 'All',
    activeStatusFilter !== null,
    searchQuery !== '',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterDept('All');
    setFilterPriority('All');
    setActiveStatusFilter(null);
    setSearchQuery('');
  };

  // ── CSV Export ──
  const handleExport = () => {
    taskService.exportToCSV(filteredTasks, `org_tasks_${filterDept}`);
  };

  // ── Stat card click handler ──
  const handleStatClick = (key) => {
    setActiveStatusFilter(prev => prev === key ? null : key);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleReviewAction = async () => {
    if (!activeTask) return;
    const isApprove = reviewModal.type === 'approve';
    const newStatus = isApprove ? 'done' : 'in_progress';
    const actionLabel = isApprove ? 'Approved' : 'Changes Requested';

    try {
      // 1. Update task status
      await updateTaskMutation.mutateAsync({
        taskId: activeTask.id,
        updates: { 
          status: newStatus, 
          progress: isApprove ? 100 : activeTask.progress,
          completed_at: isApprove ? new Date().toISOString() : null 
        },
        actorId: currentUserId,
        actionType: 'status_changed',
        oldValue: { status: activeTask.status }
      });

      // 2. Add feedback comment
      if (reviewNote.trim()) {
        await addCommentMutation.mutateAsync({
          taskId: activeTask.id,
          authorId: currentUserId,
          message: `**${actionLabel}**: ${reviewNote}`
        });
      }

      // 3. Notify assignee
      if (activeTask.assigned_to) {
        notificationService.notifyUser?.(
          activeTask.assigned_to,
          `Task ${actionLabel}`,
          `${user?.full_name} ${isApprove ? 'approved' : 'requested changes on'} "${activeTask.title}".`,
          'task',
          '/my-tasks'
        );
      }

      // 4. UI Cleanup
      setReviewModal({ open: false, type: 'approve' });
      setReviewNote('');
      // We don't close the main modal, let the admin see the status update
    } catch (err) {
      console.error('Review action failed:', err);
      alert('Failed to update task status. Please try again.');
    }
  };

  if (tasksLoading || empsLoading) {
    return (
      <div className="pb-10 p-6">
        <Skeleton variant="text" width="300px" height={60} sx={{ mb: 4 }} />
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={100} sx={{ borderRadius: 4 }} />)}
        </div>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 4 }} />
      </div>
    );
  }

  if (tasksError) {
    return (
      <div className="p-10 text-center">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 max-w-md mx-auto">
          <AlertCircle size={40} className="mx-auto mb-4" />
          <h2 className="text-lg font-black uppercase tracking-widest mb-2">Access Denied / Error</h2>
          <p className="text-xs font-bold opacity-70 mb-4">{tasksError.message || 'There was an issue fetching organization tasks.'}</p>
          <button className="btn-ems btn-ems-outline" onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Organization Tasks" subtitle="Monitor productivity and task completion across all departments.">
        <button className="btn-ems btn-ems-outline" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileDown size={18} /> Export CSV
        </button>
      </PageHeader>

      {/* ── Stats Overview (clickable) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { key: 'total', label: "Total Tasks", value: stats.total, icon: Briefcase, color: "indigo" },
          { key: 'in_progress', label: "In Progress", value: stats.inProgress, icon: Clock, color: "blue" },
          { key: 'review', label: "In Review", value: stats.inReview, icon: ThumbsUp, color: "amber" },
          { key: 'overdue', label: "Overdue", value: stats.overdue, icon: AlertCircle, color: "red" },
        ].map((stat, i) => {
          const isActive = activeStatusFilter === stat.key;
          return (
            <Box
              key={i}
              onClick={() => handleStatClick(stat.key)}
              className="card-ems-static p-6 flex items-center gap-4 border transition-all duration-300"
              sx={{
                cursor: 'pointer',
                borderColor: isActive ? `var(--${stat.color === 'indigo' ? 'primary' : stat.color})` : '#f1f5f9',
                boxShadow: isActive ? `0 0 0 2px ${stat.color === 'indigo' ? '#4f46e520' : stat.color === 'blue' ? '#3b82f620' : stat.color === 'amber' ? '#f59e0b20' : '#ef444420'}` : 'none',
                transform: isActive ? 'translateY(-2px)' : 'none',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
              }}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-600'
                }`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
              </div>
              {isActive && (
                <div className="ml-auto">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${stat.color === 'indigo' ? 'bg-indigo-500' :
                    stat.color === 'blue' ? 'bg-blue-500' :
                      stat.color === 'amber' ? 'bg-amber-500' :
                        'bg-red-500'
                    }`}></div>
                </div>
              )}
            </Box>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Left Column - Filters & Active Load ── */}
        <div className="w-full md:w-64 flex flex-col gap-6">
          {/* Filters Box */}
          <Box className="card-ems-static p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Filter size={16} className="text-indigo-600" /> Filters
              </h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-[9px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 hover:text-red-700 transition-colors"
                >
                  <X size={10} /> Clear ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Department</label>
                <select
                  className="form-select-ems text-xs font-bold"
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Priority</label>
                <select
                  className="form-select-ems text-xs font-bold"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </Box>

          {/* Performance Monitor Panel */}
          <Box className="card-ems-static p-5 border border-slate-100 bg-white shadow-sm"
            sx={{ borderRadius: '24px !important' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight">Performance Monitor</h3>
                <p className="text-[10px] font-bold text-slate-400">Track employee task performance</p>
              </div>
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Metric</label>
                <select
                  className="form-select-ems text-[10px] h-9 py-0 px-2 font-bold bg-slate-50 border-none rounded-xl"
                  value={performanceMetric}
                  onChange={(e) => setPerformanceMetric(e.target.value)}
                >
                  <option>Pending</option>
                  <option>Completed</option>
                  <option>In Review</option>
                  <option>In Progress</option>
                  <option>Overdue</option>
                  <option>Total Tasks</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Time Range</label>
                <select
                  className="form-select-ems text-[10px] h-9 py-0 px-2 font-bold bg-slate-50 border-none rounded-xl"
                  value={performanceTimeRange}
                  onChange={(e) => setPerformanceTimeRange(e.target.value)}
                >
                  <option>Today</option>
                  <option>This Week</option>
                  <option>This Month</option>
                  <option>Last 3 Months</option>
                </select>
              </div>
            </div>

            {/* Employee Performance List */}
            <div className="flex flex-col gap-5">
              {displayedTeamLoad.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-bold opacity-60 italic">No matching tasks found</p>
              ) : (
                displayedTeamLoad.map((emp, idx) => (
                  <div key={emp.id} className="group cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar
                        sx={{
                          width: 32, height: 32,
                          bgcolor: idx === 0 ? '#EEF2FF' : '#F8FAFC',
                          color: idx === 0 ? '#4F46E5' : '#64748B',
                          fontWeight: 900, fontSize: 11,
                          border: idx === 0 ? '1px solid #E0E7FF' : '1px solid #F1F5F9'
                        }}
                      >
                        {emp.name?.charAt(0)}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{emp.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{emp.count} Tasks</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(79,70,229,0.2)]"
                              style={{ width: `${emp.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-black text-slate-700 min-w-[28px] text-right">{Math.round(emp.percentage)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Action */}
            <button
              className="mt-6 w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 transition-all py-3 rounded-xl border border-transparent hover:border-indigo-100"
            >
              View Full Performance <ChevronRight size={14} />
            </button>
          </Box>
        </div>

        {/* ── Right Column - Task Table ── */}
        <div className="flex-1">
          <Box className="card-ems-static overflow-hidden border border-slate-100">
            {/* Table Header */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center bg-white">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="form-input-ems pl-10 h-10 text-xs"
                  placeholder="Search tasks, people or projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                {activeStatusFilter && (
                  <Chip
                    label={`Filtered: ${activeStatusFilter === 'total' ? 'All' : activeStatusFilter.replace('_', ' ')}`}
                    size="small"
                    onDelete={() => setActiveStatusFilter(null)}
                    sx={{
                      height: 24, fontSize: '10px', fontWeight: 800,
                      bgcolor: '#eef2ff', color: '#4f46e5',
                      textTransform: 'capitalize',
                      '& .MuiChip-deleteIcon': { color: '#4f46e5', fontSize: 14 }
                    }}
                  />
                )}
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  Showing {filteredTasks.length} tasks
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Assignee</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Task & Project</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Deadline</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <Briefcase size={40} />
                          <p className="text-xs font-bold uppercase tracking-widest">No tasks found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map(task => {
                      const dlInfo = getDeadlineInfo(task.deadline, task.status);
                      const priorityStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;

                      return (
                        <tr
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        >
                          {/* Assignee */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar sx={{
                                width: 32, height: 32,
                                fontSize: 10, fontWeight: 800,
                                bgcolor: 'var(--primary-light)',
                                color: 'var(--primary)'
                              }}>
                                {task.assigneeAvatar}
                              </Avatar>
                              <div>
                                <p className="text-xs font-bold text-slate-900 leading-tight">{task.assignedToName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Emp-ID: {task.assignee?.employee_id || 'N/A'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Task & Project */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold text-slate-900 leading-tight">{task.title}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{task.project_name || 'Personal'}</span>
                                <Chip
                                  label={task.priority}
                                  size="small"
                                  sx={{
                                    height: 16, fontSize: '8px', fontWeight: 800,
                                    bgcolor: priorityStyle.bg,
                                    color: priorityStyle.text,
                                    border: `1px solid ${priorityStyle.border}`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded-full uppercase tracking-tighter">
                              {task.departmentName}
                            </span>
                          </td>

                          {/* Deadline */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-bold ${dlInfo.type === 'overdue' ? 'text-red-500' :
                                dlInfo.type === 'today' ? 'text-amber-600' :
                                  dlInfo.type === 'soon' ? 'text-orange-500' :
                                    'text-slate-600'
                                }`}>
                                {task.deadline
                                  ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                  : 'No deadline'}
                              </span>
                              {dlInfo.type !== 'none' && dlInfo.type !== 'safe' && (
                                <Tooltip title={dlInfo.label} arrow placement="top">
                                  <span className={`inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider w-fit px-1.5 py-0.5 rounded-md ${dlInfo.type === 'overdue' ? 'bg-red-50 text-red-600' :
                                    dlInfo.type === 'today' ? 'bg-amber-50 text-amber-600' :
                                      'bg-orange-50 text-orange-600'
                                    }`}>
                                    {dlInfo.type === 'overdue' && <AlertCircle size={8} />}
                                    {dlInfo.type === 'today' && <AlertTriangle size={8} />}
                                    {dlInfo.type === 'soon' && <Clock size={8} />}
                                    {dlInfo.label}
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </td>

                          {/* Progress */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-1000 ${task.progress === 100 ? 'bg-emerald-500' :
                                    task.progress >= 50 ? 'bg-primary' :
                                      'bg-amber-400'
                                    }`}
                                  style={{ width: `${task.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-black text-slate-700">{task.progress}%</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            {(() => {
                              const config = TASK_STATUS_STYLES[task.status] || { label: task.status, color: 'slate' };
                              const colorMap = {
                                indigo: { bg: '#eef2ff', text: '#4f46e5' },
                                emerald: { bg: '#ecfdf5', text: '#10b981' },
                                amber: { bg: '#fffbeb', text: '#d97706' },
                                slate: { bg: '#f8fafc', text: '#64748b' }
                              };
                              const styles = colorMap[config.color] || colorMap.slate;
                              return (
                                <Chip
                                  label={config.label}
                                  size="small"
                                  sx={{
                                    height: 20, fontSize: '9px', fontWeight: 800,
                                    bgcolor: styles.bg,
                                    color: styles.text,
                                    border: `1px solid ${styles.text}15`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}
                                />
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Box>
        </div>
      </div>
      <Dialog
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        maxWidth={false}
        fullWidth
        container={() => document.getElementById('root')}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "32px",
              overflow: "hidden",
              bgcolor: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 25px 80px rgba(15,23,42,0.18)",
              width: "70%",
              maxWidth: "1000px",
              height: "75vh",
              border: "1px solid rgba(255,255,255,0.35)",
            },
          },
          backdrop: {
            sx: {
              bgcolor: "rgba(15,23,42,0.55)",
              backdropFilter: "blur(12px)",
            },
          },
        }}
      >
        {activeTask && (
          <div className="flex flex-col h-full bg-[#F8FAFC]">
            {/* ================= HEADER ================= */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-100 px-8 py-6">
              {/* Top Row */}
              <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
                {/* Left */}
                <div className="flex items-start gap-4">
                  <IconButton
                    onClick={() => setIsModalOpen(false)}
                    sx={{
                      bgcolor: "#F8FAFC",
                      width: 40,
                      height: 40,
                      border: "1px solid #F1F5F9",
                      "&:hover": { bgcolor: "#EEF2FF" },
                    }}
                  >
                    <ArrowLeft size={16} className="text-slate-400" />
                  </IconButton>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-600">
                          {activeTask.priority}
                        </span>
                      </div>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-none">
                      {activeTask.title}
                    </h1>
                  </div>
                </div>

                {/* Close */}
                <IconButton
                  onClick={() => setIsModalOpen(false)}
                  sx={{
                    bgcolor: "#F8FAFC",
                    border: "1px solid #F1F5F9",
                    "&:hover": { bgcolor: "#EEF2FF" },
                  }}
                >
                  <X size={20} className="text-slate-400" />
                </IconButton>
              </div>

              {/* Info Row - Same as Screenshot */}
              <div className="flex items-center gap-10 flex-wrap">
                {/* Assignee */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignee</p>
                  <div className="flex items-center gap-3">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#EEF2FF', color: '#4F46E5', fontWeight: 900, fontSize: 11 }}>
                      {activeTask.assignedToName?.charAt(0)}
                    </Avatar>
                    <span className="text-sm font-black text-slate-900">{activeTask.assignedToName}</span>
                  </div>
                </div>

                <div className="h-10 w-[1px] bg-slate-100 hidden md:block" />

                {/* Assigned By */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned By</p>
                  <div className="flex items-center gap-3">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#F8FAFC', color: '#64748B', fontWeight: 900, fontSize: 11, border: '1px solid #F1F5F9' }}>
                      {activeTask.assignedByName?.charAt(0)}
                    </Avatar>
                    <span className="text-sm font-black text-slate-900">{activeTask.assignedByName}</span>
                  </div>
                </div>

                <div className="h-10 w-[1px] bg-slate-100 hidden md:block" />

                {/* Deadline */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deadline</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <Calendar size={14} />
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      {activeTask.deadline ? new Date(activeTask.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline'}
                    </span>
                  </div>
                </div>

                <div className="h-10 w-[1px] bg-slate-100 hidden md:block" />

                {/* Status */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <div className="flex items-center gap-2">
                    <div className="h-9 px-5 rounded-full bg-amber-50 border border-amber-100 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                        {TASK_STATUS_STYLES[activeTask.status]?.label || "IN REVIEW"}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer">
                      <X size={14} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= CONTENT ================= */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-hide">
              {/* Task Breakdown */}
              <div className="bg-white border border-slate-200 rounded-[28px] p-8 shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <ListTodo size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Task Breakdown</h2>
                    <p className="text-sm text-slate-400">Subtasks & completion tracking</p>
                  </div>
                </div>

                {/* Data Table or Empty State */}
                {isActuallyLoading ? (
                  <div className="space-y-4">
                    <Skeleton variant="rounded" height={60} sx={{ borderRadius: '16px', bgcolor: 'rgba(0,0,0,0.05)' }} />
                    <Skeleton variant="rounded" height={60} sx={{ borderRadius: '16px', bgcolor: 'rgba(0,0,0,0.05)' }} />
                  </div>
                ) : displaySubtasks.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-slate-50">
                    <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center mb-5 text-slate-300">
                      <FileDown size={28} />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-2">No Breakdown Added</h3>
                    <p className="text-sm text-slate-400 max-w-md">
                      Create subtasks to organize this task into smaller actionable steps.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-8 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center w-20">#</th>
                          <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Task Description</th>
                          <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center w-48">Due Date</th>
                          <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center w-48">Updated At</th>
                          <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center w-32">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {displaySubtasks.map((group, idx) => (
                          <React.Fragment key={group.id}>
                            <tr className="bg-slate-50/20 group hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-4 text-xs font-black text-slate-900 text-center">{idx + 1}</td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-slate-800">{group.title}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{group.items?.length || 0} ITEMS</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className={`w-5 h-5 mx-auto rounded flex items-center justify-center ${group.isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100'}`}>
                                  {group.isCompleted && <Check size={12} strokeWidth={4} />}
                                </div>
                              </td>
                            </tr>
                            {group.items?.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-2"></td>
                                <td className="px-6 py-2 pl-12 border-l-2 border-slate-100 ml-4">
                                  <span className={`text-[13px] font-medium ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{item.title}</span>
                                </td>
                                <td className="px-6 py-2 text-center text-[10px] font-bold text-slate-400">{item.date || '-'}</td>
                                <td className="px-6 py-2 text-center">
                                  {item.isCompleted && item.updatedTime && (
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-indigo-400">
                                      <History size={11} /> {item.updatedTime}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-2 text-center">
                                  <div className={`w-4 h-4 mx-auto rounded border-2 flex items-center justify-center ${item.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-transparent'}`}>
                                    <Check size={10} strokeWidth={4} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="bg-white border border-slate-200 rounded-[28px] p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Info size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Full Description</h2>
                    <p className="text-sm text-slate-400">Task details & requirements</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6">
                  <p className="text-sm leading-relaxed text-blue-900 font-medium whitespace-pre-wrap">
                    {activeTask.description || "No detailed description provided for this task."}
                  </p>
                </div>
              </div>

              {/* Activity & Feedback */}
              <div className="bg-white border border-slate-200 rounded-[28px] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <MessageCircle size={22} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Activity & Feedback</h2>
                      <p className="text-sm text-slate-400">Communication & updates history</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">
                    {comments.length} COMMENTS
                  </span>
                </div>

                {comments.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-100 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center mb-5 text-emerald-300">
                      <MessageSquare size={28} />
                    </div>
                    <h3 className="text-lg font-black text-emerald-700 mb-1">No Conversations Yet</h3>
                    <p className="text-sm text-emerald-600/60 uppercase tracking-widest font-bold text-[10px]">Monitoring mode active</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-5 group">
                        <Avatar src={comment.author?.avatar_url} sx={{ width: 44, height: 44, bgcolor: '#EEF2FF', color: '#4F46E5', fontWeight: 900 }}>
                          {comment.author?.full_name?.charAt(0)}
                        </Avatar>
                        <div className="flex-1">
                          <div className={`relative text-xs leading-relaxed p-5 rounded-3xl rounded-tl-none border transition-all duration-500 group-hover:border-indigo-200 ${comment.message.includes('Approved') ? 'bg-emerald-50/40 border-emerald-100 text-emerald-900' :
                            comment.message.includes('Changes Requested') ? (comment.is_resolved ? 'bg-emerald-50/40 border-emerald-100 text-emerald-900' : 'bg-red-50/40 border-red-100 text-red-900') :
                              'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                            {comment.message.includes('**') ? (
                              <div dangerouslySetInnerHTML={{ __html: comment.message.replace(/\*\*(.*?)\*\*/g, '<b class="font-black uppercase tracking-tight">$1</b>') }} />
                            ) : (
                              <p className="font-medium whitespace-pre-wrap">{comment.message}</p>
                            )}

                            {/* Status Badge (Read Only for HR) */}
                            {comment.message.includes('Changes Requested') && (
                              <div className={`absolute -right-3 -top-3 h-7 px-4 rounded-full flex items-center gap-2 border shadow-lg ${comment.is_resolved
                                ? 'bg-emerald-500 text-white border-emerald-600'
                                : 'bg-white text-slate-400 border-slate-200'
                                }`}>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{comment.is_resolved ? 'Fixed' : 'Done'}</span>
                                <Check size={12} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-3 px-1">
                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{comment.author?.full_name}</span>
                            <span className="text-[11px] font-bold text-slate-300">• {new Date(comment.created_at).toLocaleDateString('en-GB')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                  <Avatar sx={{ width: 28, height: 28, bgcolor: '#F1F5F9', color: '#94A3B8', fontSize: 10, fontWeight: 900 }}>H</Avatar>
                  <p className="text-[11px] font-bold text-slate-400 italic">
                    Monitoring mode: comments can only be added from the task workspace.
                  </p>
                </div>
              </div>
            </div>

            {/* ================= FOOTER ================= */}
            {/* ================= FOOTER ================= */}
            <div className="sticky bottom-0 z-20 bg-white border-t border-slate-100 px-10 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    navigate(`/my-tasks/${activeTask.id}`);
                    setIsModalOpen(false);
                  }}
                  className="h-11 px-6 rounded-xl border border-indigo-100 bg-white text-indigo-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-50 transition-all"
                >
                  <ExternalLink size={14} />
                  Open Workspace
                </button>

                {activeTask.status === 'review' && (
                  <div className="flex items-center gap-3 ml-4 border-l pl-8 border-slate-100">
                    <button
                      onClick={() => setReviewModal({ open: true, type: 'revision' })}
                      className="h-11 px-6 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-amber-100 transition-all"
                    >
                      <AlertTriangle size={14} />
                      Request Revision
                    </button>
                    <button
                      onClick={() => setReviewModal({ open: true, type: 'approve' })}
                      className="h-11 px-8 rounded-xl bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center gap-3"
                    >
                      <ThumbsUp size={14} />
                      Approve Task
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 px-10 rounded-xl bg-slate-900 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-slate-100 hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  Close Task
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Review Feedback Dialog ── */}
      <Dialog
        open={reviewModal.open}
        onClose={() => setReviewModal({ ...reviewModal, open: false })}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '28px',
              padding: '32px',
              width: '440px',
              maxWidth: '95vw',
              boxShadow: '0 25px 70px rgba(0,0,0,0.15)'
            }
          }
        }}
      >
        <div className="flex flex-col gap-1 mb-6">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            {reviewModal.type === 'approve' ? (
              <><CheckCircle2 className="text-emerald-500" size={20} /> Approve Task</>
            ) : (
              <><AlertTriangle className="text-amber-500" size={20} /> Request Revision</>
            )}
          </h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {reviewModal.type === 'approve' 
              ? 'Provide final feedback for the assignee' 
              : 'Specify the required changes for this task'}
          </p>
        </div>
        
        <textarea
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder={reviewModal.type === 'approve' ? "Great work! Any final notes?" : "Please describe the changes needed..."}
          className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-[20px] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all mb-8 resize-none shadow-inner"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setReviewModal({ ...reviewModal, open: false })}
            className="flex-1 h-12 rounded-xl bg-white border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleReviewAction}
            disabled={updateTaskMutation.isPending || (reviewModal.type === 'revision' && !reviewNote.trim())}
            className={`flex-1 h-12 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
              reviewModal.type === 'approve' 
                ? 'bg-emerald-500 shadow-emerald-100 hover:bg-emerald-600' 
                : 'bg-amber-500 shadow-amber-100 hover:bg-amber-600 disabled:opacity-50 disabled:shadow-none'
            }`}
          >
            {updateTaskMutation.isPending ? <CircularProgress size={16} color="inherit" /> : 'Submit Review'}
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminTaskView;
