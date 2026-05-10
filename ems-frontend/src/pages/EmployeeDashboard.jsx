import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Avatar, Chip, Skeleton, Modal, TextField, Typography, Button } from '@mui/material';
import { toast } from 'react-hot-toast';
import { Clock, Play, Square, CheckCircle, AlertTriangle, Users, Calendar, FileText, Send, Save, ChevronRight, CheckSquare, Sparkles } from 'lucide-react';
import StatCard from '../components/StatCard';

// Hooks
import { useActiveAttendance, useAttendanceHistory, usePunchIn, usePunchOut, useStartLunch, useResumeWork, useStartOvertime, useEndOvertime } from '../hooks/useAttendance';
import { useTodayReport, useSubmitReport } from '../hooks/useReports';
import { useMyLeaves } from '../hooks/useLeaves';
import { useMyTasks } from '../hooks/useTasks';
import { profileService } from '../services/profileService';
import { reportService } from '../services/reportService';
import { taskService } from '../services/taskService';
import { communicationService } from '../services/communicationService';
import { employeeService } from '../services/employeeService';
import { supabase } from '../lib/supabaseClient';

// New Components
import CelebrationCard from '../components/CelebrationCard';
import NoticeBoard from '../components/NoticeBoard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format milliseconds → HH:MM:SS */
const formatMs = (ms) => {
  if (!ms || ms < 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
};

/** Derive elapsed ms directly from a punch_in_time string and lunch breaks */
const calcElapsedMs = (rec) => {
  if (!rec?.punch_in_time) return 0;
  const now = Date.now();
  let diff = now - new Date(rec.punch_in_time).getTime();

  if (rec.lunch_duration_ms) {
    diff -= rec.lunch_duration_ms;
  }

  if (rec.lunch_start_time) {
    const ongoingLunchMs = now - new Date(rec.lunch_start_time).getTime();
    diff -= ongoingLunchMs;
  }

  return diff > 0 ? diff : 0;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_MS = 8 * 60 * 60 * 1000; // 8 hours
// const SHIFT_MS = 10 * 1000 // 8 hours
const HALF_DAY_MS = 4 * 60 * 60 * 1000; // 4 hours
// const HALF_DAY_MS = 5 * 1000;    // 5 seconds (must be less than SHIFT_MS)
const LUNCH_LIMIT_MS = 60 * 60 * 1000; // 1 hour

// ─── Component ────────────────────────────────────────────────────────────────
const EmployeeDashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── Queries & Mutations ───────────────────────────────────────────────────
  const { data: record, isLoading: attendanceLoading } = useActiveAttendance(user?.id);
  const { data: history = [], isLoading: historyLoading } = useAttendanceHistory(user?.id, 5);
  const { data: todayReport, isLoading: reportLoading } = useTodayReport(user?.id);
  const { data: myLeaves = [] } = useMyLeaves(user?.id);
  const { data: team = [], isLoading: teamLoading } = { data: [], isLoading: false }; // We'll fetch team separately to keep it simple

  const punchInMutation = usePunchIn();
  const punchOutMutation = usePunchOut();
  // Note: we might need to add useStartLunch and useResumeWork to useAttendance.js if they don't exist
  // For now I'll assume they exist or I'll add them shortly.

  // Local state for UI only
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lunchElapsedMs, setLunchElapsedMs] = useState(0);
  const [overtimeElapsedMs, setOvertimeElapsedMs] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [todayCelebrations, setTodayCelebrations] = useState([]);
  const [reportData, setReportData] = useState({
    tasks_planned: '',
    tasks_completed: '',
    auto_filled_planned_tasks: [],
    auto_filled_completed_tasks: [],
    work_in_progress: '',
    tomorrow_plan: '',
    total_working_hours: 8,
    productivity_rating: 5,
    additional_notes: ''
  });
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeReason, setResumeReason] = useState('');

  const timerRef = useRef(null);

  // ── Sync Report State ──────────────────────────────────────────────────────
  useEffect(() => {
    if (todayReport) {
      setReportData(todayReport);
      setReportSubmitted(true);
    }
  }, [todayReport]);

  // ── Sync Team, Birthdays & Communications State ───────────────────────────
  useEffect(() => {
    // Fetch New Modules
    communicationService.getLatestAnnouncements(5).then(setAnnouncements);
    employeeService.getTodayCelebrations().then(setTodayCelebrations);

    // Realtime subscription for announcements
    const channel = supabase
      .channel('employee_announcements')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'announcements' 
      }, () => {
        communicationService.getLatestAnnouncements(5).then(setAnnouncements);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.department_id]);

  // ── Timer Logic ────────────────────────────────────────────────────────────
  const startTimer = (rec) => {
    stopTimer();
    setElapsedMs(calcElapsedMs(rec));
    setLunchElapsedMs(rec?.lunch_start_time ? Date.now() - new Date(rec.lunch_start_time).getTime() : 0);
    setOvertimeElapsedMs(rec?.overtime_start_time ? Date.now() - new Date(rec.overtime_start_time).getTime() : 0);

    timerRef.current = setInterval(() => {
      setElapsedMs(calcElapsedMs(rec));
      if (rec?.lunch_start_time) {
        setLunchElapsedMs(Date.now() - new Date(rec.lunch_start_time).getTime());
      }
      if (rec?.overtime_start_time && !rec?.overtime_end_time) {
        setOvertimeElapsedMs(Date.now() - new Date(rec.overtime_start_time).getTime());
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (record?.status === 'punched_in') {
      startTimer(record);
    } else if (record?.punch_in_time && record?.punch_out_time) {
      stopTimer();
      const diffMs = new Date(record.punch_out_time) - new Date(record.punch_in_time);
      setElapsedMs(Math.max(0, diffMs - (record.lunch_duration_ms || 0)));
      setLunchElapsedMs(0);

      // Handle overtime even if punched out
      if (record.overtime_start_time && !record.overtime_end_time) {
        startTimer(record);
      } else if (record.overtime_duration_ms) {
        setOvertimeElapsedMs(record.overtime_duration_ms);
      }
    } else {
      stopTimer();
      setElapsedMs(0);
      setLunchElapsedMs(0);
      setOvertimeElapsedMs(0);
    }
    return () => stopTimer();
  }, [record]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const loading = attendanceLoading || authLoading;
  const isPunchedIn = record?.status === 'punched_in';
  const isCompleted = record?.status === 'punched_out' || record?.status === 'auto_punched_out';
  const isLunchBreak = record?.lunch_start_time != null;
  const isShiftComplete = elapsedMs >= SHIFT_MS;
  const isHalfDayComplete = elapsedMs >= HALF_DAY_MS;
  const remainingMs = Math.max(0, SHIFT_MS - elapsedMs);
  const isLunchExceeded = isLunchBreak && lunchElapsedMs >= LUNCH_LIMIT_MS;

  // Calculate leave balance: 15 base - approved leaves
  const leaveBalance = 15 - myLeaves.filter(l => l.status === 'approved').length;

  const statusLabel = loading
    ? 'Loading...'
    : !record
      ? 'Not Started'
      : isLunchBreak
        ? isLunchExceeded ? 'Lunch Exceeded' : 'On Lunch Break'
        : isPunchedIn
          ? isShiftComplete ? 'Shift Complete' : 'Working'
          : 'Shift Ended';

  const timerDisplay = isPunchedIn
    ? formatMs(elapsedMs)
    : isCompleted
      ? formatMs(elapsedMs)
      : '00:00:00';

  const borderColor = isPunchedIn ? (isLunchBreak ? (isLunchExceeded ? '#ef4444' : '#8b5cf6') : '#10b981') : isCompleted ? '#3b82f6' : '#f59e0b';

  // ── Handlers ──────────────────────────────────────────────────────────────
  const startLunchMutation = useStartLunch();
  const resumeWorkMutation = useResumeWork();
  const startOvertimeMutation = useStartOvertime();
  const endOvertimeMutation = useEndOvertime();

  const handlePunchIn = async () => {
    try {
      setActionLoading(true);
      await punchInMutation.mutateAsync(user.id);
    } catch (err) {
      alert('Punch-in failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePunchOut = async () => {
    if (!record?.id) return;
    try {
      setActionLoading(true);
      await punchOutMutation.mutateAsync({
        recordId: record.id,
        punchInTime: record.punch_in_time,
        lunchDurationMs: record.lunch_duration_ms || 0
      });
    } catch (err) {
      alert('Punch-out failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoPunchOut = async () => {
    if (!record?.id) return;
    try {
      setActionLoading(true);
      await punchOutMutation.mutateAsync({
        recordId: record.id,
        punchInTime: record.punch_in_time,
        lunchDurationMs: record.lunch_duration_ms || 0
      });
    } catch (err) {
      alert('Auto punch-out failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartLunch = async () => {
    if (!record?.id) return;
    try {
      setActionLoading(true);
      await startLunchMutation.mutateAsync(record.id);
    } catch (err) {
      alert('Start lunch failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeWork = async (reason = null) => {
    if (!record?.id || !record?.lunch_start_time) return;
    try {
      setActionLoading(true);
      await resumeWorkMutation.mutateAsync({ recordId: record.id, reason });
      setShowResumeModal(false);
      setResumeReason('');
    } catch (err) {
      alert('Resume work failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const onResumeClick = () => {
    if (lunchElapsedMs >= LUNCH_LIMIT_MS) {
      setShowResumeModal(true);
    } else {
      handleResumeWork();
    }
  };

  const handleStartOvertime = async () => {
    if (!record?.id) return;
    try {
      setActionLoading(true);
      await startOvertimeMutation.mutateAsync(record.id);
    } catch (err) {
      alert('Start overtime failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndOvertime = async () => {
    if (!record?.id || !record?.overtime_start_time) return;
    try {
      setActionLoading(true);
      await endOvertimeMutation.mutateAsync({
        recordId: record.id,
        startTime: record.overtime_start_time
      });
    } catch (err) {
      alert('End overtime failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await reportService.submitDailyReport(user.id, reportData);
      setReportSubmitted(true);
      toast.success('Today’s report submitted successfully.');
    } catch (err) {
      console.error('Report submission failed:', err);
      toast.error('Report submission failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportChange = (e) => {
    const { name, value } = e.target;
    setReportData(prev => ({
      ...prev,
      [name]: name === 'total_working_hours' ? parseFloat(value) :
        name === 'productivity_rating' ? parseInt(value) : value
    }));
  };

  const handleAutoFill = async () => {
    if (!user?.id) return;
    try {
      setActionLoading(true);
      const myTasks = await taskService.getMyTasks(user.id);
      // Only include tasks assigned to me by someone else that are currently "In Progress"
      const inProgressTasks = myTasks.filter(t =>
        t.status === 'in_progress' &&
        t.assigned_to === user.id &&
        t.assigned_by !== user.id
      );

      const plannedItems = [];
      const completedItems = [];

      inProgressTasks.forEach(task => {
        (task.task_groups || []).forEach(group => {
          // Rule: PLANNED - Only include subtask groups (not completed)
          if (!group.is_completed) {
            plannedItems.push({
              id: group.id,
              line: `- ${task.title} → ${group.title}`
            });
          }

          // Rule: COMPLETED - Include both subtask groups AND mini-tasks
          if (group.is_completed) {
            completedItems.push({
              id: group.id,
              line: `- ${task.title} → ${group.title}`
            });
          }

          // Mini-tasks for COMPLETED
          (group.subtasks || []).forEach(mini => {
            if (mini.is_completed) {
              completedItems.push({
                id: mini.id,
                line: `  • ${task.title} → ${group.title} → ${mini.title}`
              });
            }
          });
        });
      });

      setReportData(prev => {
        const PLANNED_HEADER = "Planned subtasks today:";
        const COMPLETED_HEADER = "Completed subtasks today:";

        const stripAutoFill = (text, header) => {
          if (!text) return '';
          const lines = text.split('\n');
          const headerIdx = lines.findIndex(l => l.trim() === header);
          if (headerIdx === -1) return text.trim();
          return lines.slice(0, headerIdx).join('\n').trim();
        };

        const manualPlanned = stripAutoFill(prev.tasks_planned, PLANNED_HEADER);
        const manualCompleted = stripAutoFill(prev.tasks_completed, COMPLETED_HEADER);

        const newPlannedLines = plannedItems.map(i => i.line);
        const newCompletedLines = completedItems.map(i => i.line);
        const newAutoPlannedIds = plannedItems.map(i => i.id);
        const newAutoCompletedIds = completedItems.map(i => i.id);

        // 3. Construct final values
        const finalPlanned = (manualPlanned + (manualPlanned ? '\n\n' : '') +
          (newPlannedLines.length > 0 ? PLANNED_HEADER + '\n' + newPlannedLines.join('\n') : '')).trim();

        const finalCompleted = (manualCompleted + (manualCompleted ? '\n\n' : '') +
          (newCompletedLines.length > 0 ? COMPLETED_HEADER + '\n' + newCompletedLines.join('\n') : '')).trim();

        return {
          ...prev,
          tasks_planned: finalPlanned,
          tasks_completed: finalCompleted,
          auto_filled_planned_tasks: newAutoPlannedIds,
          auto_filled_completed_tasks: newAutoCompletedIds
        };
      });

      toast.success('Report auto-filled from tasks.');
    } catch (err) {
      console.error('[AutoFill] Error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id) return;
    try {
      setActionLoading(true);
      await reportService.submitDailyReport(user.id, reportData);
      toast.success('Draft saved successfully.');
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500">
      {/* Welcome Header */}
      <Box sx={{ mb: 2 }}>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Good Morning, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} 👋
        </h1>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          <Chip
            label={`${profile?.departments?.name || 'Operations'} Department`}
            size="small"
            sx={{ bgcolor: '#e0e7ff', color: '#4f46e5', fontWeight: 700, fontSize: 11, height: 26 }}
          />
          <span className="text-sm text-slate-500 font-medium">{profile?.role?.toUpperCase()}</span>
        </Box>
      </Box>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard title="Attendance Rate" value={loading ? '...' : '98%'} icon={Calendar} color="#4f46e5" bgColor="#eef2ff" trend="up" trendValue="+2%" />
        <StatCard title="Avg. Working Hours" value={loading ? '...' : '8.2h'} icon={Clock} color="#10b981" bgColor="#ecfdf5" />
        <StatCard title="Reports Submitted" value={loading ? '...' : `${history.length}`} icon={FileText} color="#f59e0b" bgColor="#fffbeb" />
        <StatCard title="Pending Tasks" value="3" icon={CheckCircle} color="#8b5cf6" bgColor="#f5f3ff" onClick={() => navigate('/my-tasks')} />
      </div>

      {/* Celebration Section */}
      <CelebrationCard celebrations={todayCelebrations} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* ── Attendance Timer Section (3-State Workflow) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Card 1: Shift / Overtime Slot */}
            <div className="relative overflow-hidden min-h-[220px]">
              {!isCompleted ? (
                <div className="card-ems-static h-full p-6 border-l-[6px] border-emerald-500 animate-in slide-in-from-left duration-500" style={{ borderRadius: '18px' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Shift Duration</span>
                      <h3 className="text-xl font-extrabold text-slate-900">Regular Shift</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Chip
                        label={isPunchedIn ? (isShiftComplete ? "Shift Completed" : "Working") : "Not Started"}
                        size="small"
                        sx={{
                          bgcolor: isPunchedIn ? (isShiftComplete ? '#dcfce7' : '#ecfdf5') : '#f1f5f9',
                          color: isPunchedIn ? (isShiftComplete ? '#15803d' : '#10b981') : '#64748b',
                          fontWeight: 800, fontSize: 10, height: 24
                        }}
                      />
                      {record?.punch_in_time && (
                        <span className="text-[10px] font-bold text-slate-400">IN: {new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-4xl font-black tracking-tighter text-slate-900 mb-6 flex items-baseline gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {timerDisplay}
                    {isPunchedIn && !isShiftComplete && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>

                  {!record ? (
                    <button className="btn-ems btn-ems-success w-full h-12 rounded-[14px]" onClick={handlePunchIn} disabled={actionLoading}>
                      <Play size={18} /> {actionLoading ? 'Pinching In...' : 'Start Today’s Shift'}
                    </button>
                  ) : (
                    <button
                      className={`btn-ems w-full h-12 rounded-[14px] ${isShiftComplete ? 'btn-ems-danger shadow-lg shadow-red-100' : 'btn-ems-secondary'}`}
                      onClick={isShiftComplete ? handleAutoPunchOut : handlePunchOut}
                      disabled={actionLoading || (isPunchedIn && !isHalfDayComplete)}
                    >
                      <Square size={18} /> {isShiftComplete ? 'Punch Out (Completed)' : 'Punch Out'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="card-ems-static h-full p-6 border-l-[6px] border-indigo-500 animate-in fade-in zoom-in duration-500" style={{ borderRadius: '18px' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Post-Shift Tracking</span>
                      <h3 className="text-xl font-extrabold text-slate-900">Overtime Session</h3>
                    </div>
                    <Chip
                      label={record.overtime_start_time && !record.overtime_end_time ? "Overtime Active" : "Day Completed"}
                      size="small"
                      sx={{
                        bgcolor: record.overtime_start_time && !record.overtime_end_time ? '#e0e7ff' : '#f1f5f9',
                        color: record.overtime_start_time && !record.overtime_end_time ? '#4f46e5' : '#64748b',
                        fontWeight: 800, fontSize: 10, height: 24
                      }}
                    />
                  </div>

                  <div className="text-4xl font-black tracking-tighter text-slate-900 mb-6 flex items-baseline gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatMs(overtimeElapsedMs)}
                    {record.overtime_start_time && !record.overtime_end_time && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </div>

                  {!record.overtime_start_time ? (
                    <button className="btn-ems btn-ems-primary w-full h-12 rounded-[14px]" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }} onClick={handleStartOvertime} disabled={actionLoading}>
                      <Play size={18} /> Start Overtime
                    </button>
                  ) : !record.overtime_end_time ? (
                    <button className="btn-ems btn-ems-danger w-full h-12 rounded-[14px]" onClick={handleEndOvertime} disabled={actionLoading}>
                      <Square size={18} /> End Overtime
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <CheckCircle size={18} className="text-emerald-500" />
                      <span className="text-sm font-bold text-slate-700">Total OT: {formatMs(record.overtime_duration_ms)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card 2: Lunch Break (Visible anytime during active shift) */}
            <div className={`transition-all duration-500 ${isPunchedIn && !isCompleted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <div className="card-ems-static h-full p-6 border-l-[6px] border-amber-500" style={{ borderRadius: '18px' }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">Rest & Recovery</span>
                    <h3 className="text-xl font-extrabold text-slate-900">Lunch Break</h3>
                  </div>
                  <Chip
                    label={isLunchBreak ? "On Break" : "Shift Active"}
                    size="small"
                    sx={{
                      bgcolor: isLunchBreak ? '#fffbeb' : '#f1f5f9',
                      color: isLunchBreak ? '#b45309' : '#64748b',
                      fontWeight: 800, fontSize: 10, height: 24
                    }}
                  />
                </div>

                <div className="text-4xl font-black tracking-tighter text-slate-900 mb-6 flex items-baseline gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatMs(lunchElapsedMs)}
                  {isLunchBreak && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </div>

                {isLunchBreak ? (
                  <button
                    className={`btn-ems w-full h-12 rounded-[14px] ${isLunchExceeded ? 'btn-ems-danger' : 'btn-ems-primary'}`}
                    onClick={onResumeClick}
                    disabled={actionLoading}
                    style={{ background: isLunchExceeded ? '#ef4444' : '#f59e0b', border: 'none' }}
                  >
                    <Play size={18} /> {isLunchExceeded ? 'Resume Work (Overdue)' : 'Resume Work'}
                  </button>
                ) : (
                  <button
                    className="btn-ems btn-ems-secondary w-full h-12 rounded-[14px]"
                    onClick={handleStartLunch}
                    disabled={actionLoading || isShiftComplete}
                  >
                    <Clock size={18} /> Start Lunch Break
                  </button>
                )}

                {isLunchBreak && (
                  <span className="text-[10px] font-bold text-amber-600 mt-3 block text-center uppercase tracking-tight">
                    {isLunchExceeded ? "Limit exceeded by " + formatMs(lunchElapsedMs - LUNCH_LIMIT_MS) : formatMs(Math.max(0, LUNCH_LIMIT_MS - lunchElapsedMs)) + " remaining"}
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* ── Daily Report ── */}
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} /> Daily Work Report
              </h3>
              <div className="flex items-center gap-2">
                {!reportSubmitted && (
                  <button
                    type="button"
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
                    onClick={handleAutoFill}
                    disabled={actionLoading}
                  >
                    <Sparkles size={12} /> Auto-fill from tasks
                  </button>
                )}
                {reportSubmitted && (
                  <span className="badge-pill success flex items-center gap-1">
                    <CheckCircle size={13} /> Submitted
                  </span>
                )}
              </div>
            </div>

            {!reportSubmitted ? (
              <form onSubmit={handleReportSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-7">
                  {/* Column 1: Planned and Completed */}
                  <div className="flex flex-col gap-7">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Tasks Planned Today</label>
                      <textarea
                        name="tasks_planned" className="form-input-premium" placeholder="List tasks planned for today..."
                        value={reportData.tasks_planned} onChange={handleReportChange} style={{ resize: 'none', minHeight: '140px' }} required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Tasks Completed</label>
                      <textarea
                        name="tasks_completed" className="form-input-premium" placeholder="List completed tasks..."
                        value={reportData.tasks_completed} onChange={handleReportChange} style={{ resize: 'none', minHeight: '170px' }} required
                      />
                    </div>
                  </div>

                  {/* Column 2: WIP and Tomorrow */}
                  <div className="flex flex-col gap-7">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Work In Progress</label>
                      <textarea
                        name="work_in_progress" className="form-input-premium" placeholder="Mention ongoing tasks..."
                        value={reportData.work_in_progress} onChange={handleReportChange} style={{ resize: 'none', minHeight: '140px' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Tomorrow Plan</label>
                      <textarea
                        name="tomorrow_plan" className="form-input-premium" placeholder="Plan for tomorrow..."
                        value={reportData.tomorrow_plan} onChange={handleReportChange} style={{ resize: 'none', minHeight: '170px' }} required
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 mb-7">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Total Working Hours</label>
                    <input
                      type="number" name="total_working_hours" className="form-input-premium"
                      min="0" max="24" step="0.5" value={reportData.total_working_hours} onChange={handleReportChange} required
                      style={{ height: '52px' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Productivity Rating (1-10)</label>
                    <select
                      name="productivity_rating" className="form-input-premium"
                      value={reportData.productivity_rating} onChange={handleReportChange}
                      style={{ height: '52px' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} - {n <= 3 ? 'Low' : n <= 7 ? 'Good' : 'Excellent'}</option>)}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-7">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Additional Notes</label>
                  <textarea
                    name="additional_notes" className="form-input-premium" placeholder="Any extra notes..."
                    value={reportData.additional_notes} onChange={handleReportChange} style={{ resize: 'none', minHeight: '110px' }}
                  />
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="btn-ems btn-ems-primary flex-1" style={{ height: '52px', borderRadius: '14px' }} disabled={actionLoading}>
                    <Send size={18} /> {actionLoading ? 'Submitting...' : 'Submit Today’s Report'}
                  </button>
                  <button type="button" className="btn-ems btn-ems-secondary" style={{ width: 160, height: '52px', borderRadius: '14px' }} onClick={handleSaveDraft} disabled={actionLoading}>
                    <Save size={18} /> Save Draft
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="alert-ems success">
                  <CheckCircle size={16} />
                  <span>Today’s report submitted successfully. You can review your summary below.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Planned Today</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{reportData.tasks_planned}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Completed</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{reportData.tasks_completed}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">In Progress</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{reportData.work_in_progress || 'None'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tomorrow Plan</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{reportData.tomorrow_plan}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Hours Worked</p>
                    <p className="text-sm font-bold text-indigo-700">{reportData.total_working_hours} Hours</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Rating</p>
                    <p className="text-sm font-bold text-indigo-700">{reportData.productivity_rating} / 10</p>
                  </div>
                </div>

                <button className="text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1 justify-center mt-2" onClick={() => setReportSubmitted(false)}>
                  Update Today's Report
                </button>
              </div>
            )}
          </Box>

          {/* ── Recent Activity ── */}
          <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 3, pb: 0 }}>
              <h3 className="text-base font-bold text-slate-900 mb-4">Recent Activity</h3>
            </Box>
            <div className="table-responsive">
              <table className="table-ems">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="4" className="text-center p-4 text-slate-400">Loading history...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan="4" className="text-center p-4 text-slate-400">No activity found</td></tr>
                  ) : history.map((log, i) => (
                    <tr key={log.id || i}>
                      <td className="text-sm font-medium">
                        {/* attendance_date is YYYY-MM-DD — append T00:00 to parse as local */}
                        {new Date(`${log.attendance_date}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="text-sm font-bold">
                        {log.total_hours ? `${log.total_hours}h` : log.status === 'punched_in' ? 'Ongoing' : '--'}
                      </td>
                      <td>
                        <span className={`status-dot ${log.status === 'punched_in' ? 'online' : 'offline'}`}>
                          {log.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-icon-ems" style={{ width: 30, height: 30 }} aria-label="View details">
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Notice Board */}
          <NoticeBoard announcements={announcements} />

          {/* Team Status */}
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} /> Team Status
              </h3>
              <span className="badge-pill info">{teamMembers.length} Members</span>
            </div>
            <div className="flex flex-col gap-3">
              {loading || teamLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: '12px' }} />)
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No team members found</p>
              ) : teamMembers.map((member, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-slate-50 cursor-pointer">
                  <Avatar sx={{ width: 40, height: 40, bgcolor: '#f1f5f9', color: '#4f46e5', fontWeight: 700, fontSize: 13 }}>
                    {member.full_name?.charAt(0) || '?'}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{member.full_name}</p>
                    <p className="text-xs text-slate-500 font-medium">{member.designation || 'Member'}</p>
                  </div>
                  <span className="status-dot online" />
                </div>
              ))}
            </div>
          </Box>

          {/* Tasks At A Glance */}
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare size={18} className="text-indigo-600" /> My Tasks
              </h3>
              <button className="text-xs font-bold text-indigo-600 hover:underline" onClick={() => navigate('/my-tasks')}>View All</button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { title: "Implement Sidebar for Employee Hub", project: "EMS Pro", progress: 60, status: "In Progress" },
                { title: "Fix Login authentication bug", project: "Security", progress: 100, status: "Done" },
              ].map((task, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all cursor-pointer" onClick={() => navigate('/my-tasks')}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{task.title}</p>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${task.status === 'Done' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${task.progress}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{task.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Box>

          {/* Leave CTA */}
          <Box sx={{
            p: 3, borderRadius: '14px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#fff',
          }}>
            <h3 className="text-base font-bold mb-1">Need a Break?</h3>
            <p className="text-sm opacity-70 mb-4">You have {leaveBalance} annual leave days remaining. Take a rest!</p>
            <button className="btn-ems w-full" style={{
              height: 42, background: 'rgba(255,255,255,0.15)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '10px', fontWeight: 700
            }}>
              Apply for Leave
            </button>
          </Box>

          {/* Upcoming Birthdays */}
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <h3 className="text-base font-bold text-slate-900 mb-4">🎂 Upcoming Birthdays</h3>
            <div className="flex flex-col gap-3">
              {loading ? (
                [1, 2].map(i => <Skeleton key={i} variant="rounded" height={50} sx={{ borderRadius: '8px' }} />)
              ) : birthdays.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">No upcoming birthdays</p>
              ) : birthdays.map((person, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-all">
                  <Avatar sx={{ width: 36, height: 36, bgcolor: '#fef3c7', color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>
                    {person.full_name?.charAt(0)}
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{person.full_name}</p>
                    <p className="text-xs text-slate-500">{person.departments?.name || 'Department'}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    {new Date(person.birthday).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </Box>
        </div>
      </div>

      {/* Late Resume Modal */}
      <Modal open={showResumeModal} onClose={() => setShowResumeModal(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 400, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 24, p: 4
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#ef4444' }}>
            <AlertTriangle size={24} /> Lunch Limit Exceeded
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            You have exceeded the maximum lunch break time of 1 hour. Please provide a reason for the delay before resuming work.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="E.g., Unexpected client call, delayed at cafeteria..."
            value={resumeReason}
            onChange={(e) => setResumeReason(e.target.value)}
            sx={{ mb: 3 }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outlined" onClick={() => setShowResumeModal(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={!resumeReason.trim() || actionLoading}
              onClick={() => handleResumeWork(resumeReason)}
            >
              {actionLoading ? 'Submitting...' : 'Submit & Resume'}
            </Button>
          </div>
        </Box>
      </Modal>

    </div>
  );
};

export default EmployeeDashboard;
