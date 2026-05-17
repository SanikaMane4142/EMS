import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Avatar, Chip, Skeleton, Modal, TextField, Typography, Button, useMediaQuery } from '@mui/material';
import { toast } from 'react-hot-toast';
import { Clock, Play, Square, CheckCircle, AlertTriangle, Users, Calendar, FileText, Send, Save, ChevronRight, CheckSquare, Sparkles, Monitor, Globe } from 'lucide-react';
import StatCard from '../components/StatCard';

// Hooks
import { useActiveAttendance, useAttendanceHistory, usePunchIn, usePunchOut, useStartLunch, useResumeWork, useStartOvertime, useEndOvertime, useEmployeeDashboardStats, useIpValidity } from '../hooks/useAttendance';
import { useTodayReport, useSubmitReport, useMonthlyReportCount } from '../hooks/useReports';
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

/** Derive elapsed ms directly from a punch_in_time string and lunch breaks, calibrated with clockDrift */
const calcElapsedMs = (rec, clockDrift = 0) => {
  if (!rec?.punch_in_time) return 0;
  const now = Date.now() + clockDrift;
  let diff = now - new Date(rec.punch_in_time).getTime();

  if (rec.lunch_duration_ms) {
    diff -= rec.lunch_duration_ms;
  }

  if (rec.lunch_start_time && !rec.lunch_end_time) {
    const ongoingLunchMs = now - new Date(rec.lunch_start_time).getTime();
    diff -= ongoingLunchMs;
  }

  return diff > 0 ? diff : 0;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_MS          = 8 * 60 * 60 * 1000;       // 8 hours    — regular paid hours
const AUTO_PUNCH_OUT_MS = 8.5 * 60 * 60 * 1000;     // 8h 30m     — auto punch-out trigger
const HALF_DAY_MS       = 4 * 60 * 60 * 1000;       // 4 hours    — minimum for half-day
const LUNCH_LIMIT_MS    = 60 * 60 * 1000;            // 1 hour     — lunch break limit

// ─── Component ────────────────────────────────────────────────────────────────
const EmployeeDashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:767px)');

  // ── Queries & Mutations ───────────────────────────────────────────────────
  const { data: record, isLoading: attendanceLoading } = useActiveAttendance(user?.id);
  const { data: history = [], isLoading: historyLoading } = useAttendanceHistory(user?.id, { limit: 5 });
  const { data: todayReport, isLoading: reportLoading } = useTodayReport(user?.id);
  const { data: myTasks = [], isLoading: tasksLoading } = useMyTasks(user?.id);
  const { data: monthlyStats, isLoading: statsLoading } = useEmployeeDashboardStats(user?.id);
  const { data: monthlyReports, isLoading: reportsCountLoading } = useMonthlyReportCount(user?.id);
  const { data: ipStatus } = useIpValidity();

  const { data: team = [], isLoading: teamLoading } = { data: [], isLoading: false };

  const punchInMutation = usePunchIn();
  const punchOutMutation = usePunchOut();
  // Note: we might need to add useStartLunch and useResumeWork to useAttendance.js if they don't exist
  // For now I'll assume they exist or I'll add them shortly.

  // Local state for UI only
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lunchElapsedMs, setLunchElapsedMs] = useState(0);
  const [overtimeElapsedMs, setOvertimeElapsedMs] = useState(0);
  const [clockDrift, setClockDrift] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Calibrate client clock against Supabase server to prevent premature auto punch-out from local clock drift
  useEffect(() => {
    const calibrateClock = async () => {
      try {
        const start = Date.now();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`);
        const dateHeader = res.headers.get('date');
        if (dateHeader) {
          const serverMs = new Date(dateHeader).getTime();
          const latency = (Date.now() - start) / 2; // Estimate network latency
          const calibratedDrift = (serverMs + latency) - Date.now();
          setClockDrift(calibratedDrift);
          console.log(`[Clock Calibration] Server time drift calibrated: ${calibratedDrift}ms`);
        }
      } catch (err) {
        console.warn('[Clock Calibration] Failed to calibrate client clock:', err.message);
      }
    };
    calibrateClock();
  }, []);
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
    blockers: '',
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

    // Fetch Birthdays and Team Members
    profileService.getUpcomingBirthdays().then(setBirthdays);
    if (profile?.department_id) {
      profileService.getDepartmentMembers(profile.department_id).then(setTeamMembers);
    }

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

    // Realtime subscription for team status (attendance changes)
    const teamChannel = supabase
      .channel('team_status')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance' 
      }, () => {
        if (profile?.department_id) {
          profileService.getDepartmentMembers(profile.department_id).then(setTeamMembers);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(teamChannel);
    };
  }, [profile?.id, profile?.department_id]);

  // ── Timer Logic ────────────────────────────────────────────────────────────
  const startTimer = (rec) => {
    stopTimer();
    setElapsedMs(calcElapsedMs(rec, clockDrift));
    const getNow = () => Date.now() + clockDrift;

    setLunchElapsedMs(rec?.lunch_start_time && !rec?.lunch_end_time ? getNow() - new Date(rec.lunch_start_time).getTime() : 0);
    setOvertimeElapsedMs(rec?.overtime_start_time ? getNow() - new Date(rec.overtime_start_time).getTime() : 0);

    timerRef.current = setInterval(() => {
      setElapsedMs(calcElapsedMs(rec, clockDrift));
      const calibratedNow = getNow();
      if (rec?.lunch_start_time && !rec?.lunch_end_time) {
        setLunchElapsedMs(calibratedNow - new Date(rec.lunch_start_time).getTime());
      }
      if (rec?.overtime_start_time && !rec?.overtime_end_time) {
        setOvertimeElapsedMs(calibratedNow - new Date(rec.overtime_start_time).getTime());
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Ref to prevent firing auto punch-out multiple times
  const autoPunchOutFiredRef = useRef(false);

  useEffect(() => {
    if (record?.status === 'punched_in') {
      startTimer(record);
      autoPunchOutFiredRef.current = false;
    } else if (record?.punch_in_time && record?.punch_out_time) {
      stopTimer();
      // Display duration is always punch_out - punch_in - lunch (as stored by server)
      const diffMs = new Date(record.punch_out_time) - new Date(record.punch_in_time);
      setElapsedMs(Math.max(0, diffMs - (record.lunch_duration_ms || 0)));
      setLunchElapsedMs(0);

      // Handle overtime tracking after punch-out
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
  }, [record, clockDrift]);

  // ── Auto Punch-Out at 8h 30m ────────────────────────────────────────────────
  // Watches elapsed time; fires once when it crosses AUTO_PUNCH_OUT_MS
  useEffect(() => {
    if (
      record?.status === 'punched_in' &&
      !autoPunchOutFiredRef.current &&
      elapsedMs >= AUTO_PUNCH_OUT_MS
    ) {
      autoPunchOutFiredRef.current = true;
      console.log('[Attendance] Auto punch-out triggered at 8h30m');

      // Silently punch out — no confirmation dialog for auto punch-out
      punchOutMutation.mutateAsync({
        recordId: record.id,
        punchInTime: record.punch_in_time,
        lunchDurationMs: record.lunch_duration_ms || 0,
        isAutoPunchOut: true,
      }).catch((err) => {
        console.error('[Attendance] Auto punch-out failed:', err.message);
        autoPunchOutFiredRef.current = false; // allow retry on next tick
      });
    }
  }, [elapsedMs, record]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const loading = attendanceLoading || authLoading;
  const isPunchedIn = record?.status === 'punched_in' && record?.punch_in_time != null;
  const isCompleted = record?.status === 'punched_out' || record?.status === 'auto_punched_out';
  const isLunchBreak = record?.lunch_start_time != null && !record?.lunch_end_time;
  // 8h reached = regular shift complete (used for overtime card visibility)
  const isShiftComplete = elapsedMs >= SHIFT_MS;
  const isHalfDayComplete = elapsedMs >= HALF_DAY_MS;
  const remainingMs = Math.max(0, SHIFT_MS - elapsedMs);
  const isLunchExceeded = isLunchBreak && lunchElapsedMs >= LUNCH_LIMIT_MS;
  // Overtime card: only visible after the shift has been punched out AND 8h were worked
  const showOvertimeCard = isCompleted && isShiftComplete;



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
      toast.success('Punched in successfully!');
    } catch (err) {
      if (err.message.includes('IP_RESTRICTED')) {
        Swal.fire({
          title: 'Restricted Access',
          text: 'Attendance actions are only allowed from the approved office network.',
          icon: 'error',
          confirmButtonColor: '#4f46e5',
          background: '#ffffff',
          borderRadius: '24px'
        });
      } else {
        toast.error('Punch-in failed: ' + err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };
  const handlePunchOut = async () => {
    if (!record?.id) return;

    const result = await Swal.fire({
      title: 'Ready to Punch Out?',
      text: "You are about to end your shift for today. Make sure you've submitted your daily report!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Punch Out',
      cancelButtonText: 'Not yet',
      background: '#ffffff',
      borderRadius: '24px',
      customClass: {
        title: 'text-xl font-black text-slate-900',
        htmlContainer: 'text-sm font-medium text-slate-500',
        confirmButton: 'rounded-xl px-6 py-3 text-sm font-bold',
        cancelButton: 'rounded-xl px-6 py-3 text-sm font-bold'
      }
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);
      await punchOutMutation.mutateAsync({
        recordId: record.id,
        punchInTime: record.punch_in_time,
        lunchDurationMs: record.lunch_duration_ms || 0
      });
      toast.success('Punched out successfully!');
    } catch (err) {
      if (err.message.includes('IP_RESTRICTED')) {
        Swal.fire({
          title: 'Restricted Access',
          text: 'Manual punch-out is only allowed from the approved office network.',
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
      } else {
        Swal.fire({
          title: 'Error',
          text: 'Punch-out failed: ' + err.message,
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
      }
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
      await resumeWorkMutation.mutateAsync({
        recordId: record.id,
        lunchStartTime: record.lunch_start_time,
        currentDurationMs: record.lunch_duration_ms || 0,
        reason,
      });
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
      toast.success('Overtime started!');
    } catch (err) {
      if (err.message.includes('IP_RESTRICTED')) {
        Swal.fire({
          title: 'Restricted Access',
          text: 'Overtime actions are only allowed from the approved office network.',
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
      } else {
        toast.error('Start overtime failed: ' + err.message);
      }
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
      toast.success('Overtime ended!');
    } catch (err) {
      if (err.message.includes('IP_RESTRICTED')) {
        Swal.fire({
          title: 'Restricted Access',
          text: 'Overtime actions are only allowed from the approved office network.',
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
      } else {
        toast.error('End overtime failed: ' + err.message);
      }
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

      // ── "Today" boundary using IST (Asia/Kolkata) — consistent with reportService ──
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "YYYY-MM-DD"

      const isUpdatedToday = (dateStr) => {
        if (!dateStr) return false;
        // Convert the UTC timestamp to IST date string for comparison
        const d = new Date(dateStr);
        const dIST = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return dIST === todayIST;
      };

      // ── Fix 1: Include ALL tasks assigned TO the employee (self-assigned included)
      // ── Fix 2: Include 'done' tasks updated today (finished same day)
      // ── Fix 3: Include 'review' tasks (submitted for review = work completed)
      // ── Fix 4: Include 'in_progress' tasks (ongoing work for the day)
      // ── Fix 5: Include 'pending' tasks only if they were updated today (started today)
      const relevantTasks = myTasks.filter(t => {
        // Must be assigned to this employee (self-assigned is allowed)
        if (t.assigned_to !== user.id) return false;

        // Always include active/ongoing tasks
        if (t.status === 'in_progress') return true;

        // Include tasks submitted for review today
        if (t.status === 'review' && isUpdatedToday(t.updated_at)) return true;

        // Include tasks fully completed today
        if (t.status === 'done' && isUpdatedToday(t.updated_at)) return true;

        // Include pending tasks that were touched today (e.g., groups added/updated)
        if (t.status === 'pending' && isUpdatedToday(t.updated_at)) return true;

        return false;
      });

      const plannedItems = [];
      const completedItems = [];
      const reviewItems = [];

      relevantTasks.forEach(task => {
        const taskGroups = (task.task_groups || []).filter(g => !g.is_deleted);

        // ── Case A: Entire task completed today with NO subtask groups ──
        if (task.status === 'done' && isUpdatedToday(task.updated_at) && taskGroups.length === 0) {
          completedItems.push({
            id: task.id,
            line: `- ${task.title} ✓`
          });
          return;
        }

        // ── Case B: Task submitted for review today with NO subtask groups ──
        if (task.status === 'review' && isUpdatedToday(task.updated_at) && taskGroups.length === 0) {
          reviewItems.push({
            id: task.id,
            line: `- ${task.title} (submitted for review)`
          });
          return;
        }

        // ── Case B2: Task is active with NO subtask groups ──
        if ((task.status === 'in_progress' || task.status === 'pending') && taskGroups.length === 0) {
          plannedItems.push({
            id: task.id,
            line: `- ${task.title}`
          });
          return;
        }

        // ── Case C: Iterate subtask groups ──
        taskGroups.forEach(group => {
          const groupMinis = (group.subtasks || []).filter(s => !s.is_deleted);

          if (group.is_completed) {
            // Group was completed — ONLY add to completed if done today
            if (isUpdatedToday(group.updated_at)) {
              completedItems.push({
                id: group.id,
                line: `- ${task.title} → ${group.title} ✓`
              });
            }

            // Also list individual mini-tasks that are done within this group
            groupMinis.forEach(mini => {
              if (mini.is_completed && isUpdatedToday(mini.updated_at)) {
                completedItems.push({
                  id: mini.id,
                  line: `   • ${mini.title}`
                });
              }
            });
          } else {
            // Group not yet completed — it's planned / in progress for today
            plannedItems.push({
              id: group.id,
              line: `- ${task.title} → ${group.title}`
            });

            // Include any individual mini-tasks completed today within this pending group
            // Only show mini-task title — parent path is already shown in the group line above
            groupMinis.forEach(mini => {
              if (mini.is_completed && isUpdatedToday(mini.updated_at)) {
                completedItems.push({
                  id: mini.id,
                  line: `   • ${mini.title} ✓`
                });
              }
            });
          }
        });
      });

      // Merge reviewItems into completedItems with a note
      const allCompletedItems = [...completedItems, ...reviewItems];

      setReportData(prev => {
        const PLANNED_HEADER   = "── Auto-filled: Planned Today ──";
        const COMPLETED_HEADER = "── Auto-filled: Completed Today ──";

        // Strip previously auto-filled sections so re-running doesn't duplicate
        const stripAutoFill = (text, header) => {
          if (!text) return '';
          const lines = text.split('\n');
          const headerIdx = lines.findIndex(l => l.trim() === header);
          if (headerIdx === -1) return text.trim();
          return lines.slice(0, headerIdx).join('\n').trim();
        };

        const manualPlanned   = stripAutoFill(prev.tasks_planned,   PLANNED_HEADER);
        const manualCompleted = stripAutoFill(prev.tasks_completed,  COMPLETED_HEADER);

        const newPlannedLines   = plannedItems.map(i => i.line);
        const newCompletedLines = allCompletedItems.map(i => i.line);

        const finalPlanned = (
          manualPlanned +
          (manualPlanned && newPlannedLines.length > 0 ? '\n\n' : '') +
          (newPlannedLines.length > 0 ? PLANNED_HEADER + '\n' + newPlannedLines.join('\n') : '')
        ).trim();

        const finalCompleted = (
          manualCompleted +
          (manualCompleted && newCompletedLines.length > 0 ? '\n\n' : '') +
          (newCompletedLines.length > 0 ? COMPLETED_HEADER + '\n' + newCompletedLines.join('\n') : '')
        ).trim();

        return {
          ...prev,
          tasks_planned:               finalPlanned,
          tasks_completed:             finalCompleted,
          auto_filled_planned_tasks:   plannedItems.map(i => i.id),
          auto_filled_completed_tasks: allCompletedItems.map(i => i.id),
        };
      });

      const totalFound = plannedItems.length + allCompletedItems.length;
      if (totalFound === 0) {
        toast('No active tasks found for today. Add tasks in the Tasks Center first.', { icon: '📋' });
      } else {
        toast.success(
          `Auto-filled: ${plannedItems.length} planned, ${allCompletedItems.length} completed today.`
        );
      }
    } catch (err) {
      console.error('[AutoFill] Error:', err);
      toast.error('Auto-fill failed. Please try again.');
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
        <StatCard 
          title="Attendance Rate" 
          value={statsLoading ? '...' : `${monthlyStats?.attendanceRate || 0}%`} 
          icon={Calendar} 
          color="#4f46e5" 
          bgColor="#eef2ff" 
          trend={monthlyStats?.attendanceRate >= 90 ? "up" : "down"} 
          trendValue={monthlyStats?.attendanceRate >= 90 ? "+2%" : ""} 
        />
        <StatCard 
          title="Avg. Working Hours" 
          value={statsLoading ? '...' : `${monthlyStats?.avgHours || 0}h`} 
          icon={Clock} 
          color="#10b981" 
          bgColor="#ecfdf5" 
        />
        <StatCard 
          title="Reports Submitted" 
          value={reportsCountLoading ? '...' : `${monthlyReports || 0}`} 
          icon={FileText} 
          color="#f59e0b" 
          bgColor="#fffbeb" 
        />
        <StatCard 
          title="Pending Tasks" 
          value={tasksLoading ? '...' : `${myTasks.filter(t => t.status === 'pending').length}`} 
          icon={CheckCircle} 
          color="#8b5cf6" 
          bgColor="#f5f3ff" 
          onClick={() => navigate('/my-tasks', { state: { statusFilter: 'pending' } })}
        />
      </div>

      {/* Celebration Section */}
      <CelebrationCard celebrations={todayCelebrations} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* ── Attendance Timer Section (3-State Workflow) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="relative overflow-hidden min-h-[220px]">
              <div className="card-ems-static h-full p-6 border-l-[6px] animate-in slide-in-from-left duration-500"
                style={{
                  borderRadius: '18px',
                  borderColor: isCompleted ? '#3b82f6' : isPunchedIn ? '#10b981' : '#f59e0b'
                }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Duration</span>
                      {ipStatus && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${ipStatus.is_office_network ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          <Globe size={10} />
                          {ipStatus.is_office_network ? 'Office Network' : 'Remote'}
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900">Regular Shift</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Chip
                      label={
                        isCompleted
                          ? (record?.status === 'auto_punched_out' ? 'Auto Punched Out' : 'Shift Ended')
                          : isPunchedIn
                            ? (isShiftComplete ? 'Shift Complete' : 'Working')
                            : 'Not Started'
                      }
                      size="small"
                      sx={{
                        bgcolor: isCompleted ? '#dbeafe' : isPunchedIn ? (isShiftComplete ? '#dcfce7' : '#ecfdf5') : '#f1f5f9',
                        color:   isCompleted ? '#1d4ed8' : isPunchedIn ? (isShiftComplete ? '#15803d' : '#10b981') : '#64748b',
                        fontWeight: 800, fontSize: 10, height: 24
                      }}
                    />
                    {record?.punch_in_time && (
                      <span className="text-[10px] font-bold text-slate-400">IN: {new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {isCompleted && record?.punch_out_time && (
                      <span className="text-[10px] font-bold text-slate-400">OUT: {new Date(record.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>

                <div className="text-4xl font-black tracking-tighter text-slate-900 mb-6 flex items-baseline gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {timerDisplay}
                  {isPunchedIn && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                {/* Sub-label: shows auto punch-out countdown when nearing 8h30m */}
                {isPunchedIn && elapsedMs >= SHIFT_MS && elapsedMs < AUTO_PUNCH_OUT_MS && (
                  <p className="text-[11px] font-bold text-amber-600 mb-3 flex items-center gap-1">
                    ⚡ Auto punch-out in {formatMs(AUTO_PUNCH_OUT_MS - elapsedMs)}
                  </p>
                )}

                {isMobile ? (
                  <div className="flex flex-col gap-3 p-4 bg-amber-50/50 rounded-[14px] border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-600">
                      <Monitor size={18} />
                      <span className="text-[11px] font-black uppercase tracking-tight">Desktop Only Feature</span>
                    </div>
                    <p className="text-[11px] font-bold text-amber-800 leading-tight">
                      Attendance actions are only available on desktop. Please use a desktop device to punch in/out.
                    </p>
                  </div>
                ) : (
                  <>
                    {!record || (!isPunchedIn && !isCompleted) ? (
                      <button className="btn-ems btn-ems-success w-full h-12 rounded-[14px]" onClick={handlePunchIn} disabled={actionLoading}>
                        <Play size={18} /> {actionLoading ? 'Punching In...' : 'Start Today\'s Shift'}
                      </button>
                    ) : isCompleted ? (
                      <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <CheckCircle size={18} className="text-blue-500" />
                        <span className="text-sm font-bold text-blue-700">
                          {record?.status === 'auto_punched_out'
                            ? `Auto closed · 8h paid · ${formatMs(elapsedMs)} logged`
                            : `Shift ended · ${formatMs(elapsedMs)} logged`
                          }
                        </span>
                      </div>
                    ) : isPunchedIn ? (
                      <button
                        className={`btn-ems w-full h-12 rounded-[14px] ${isShiftComplete ? 'btn-ems-danger shadow-lg shadow-red-100' : 'btn-ems-secondary'}`}
                        onClick={handlePunchOut}
                        disabled={actionLoading || (isPunchedIn && !isHalfDayComplete)}
                      >
                        <Square size={18} /> {isShiftComplete ? 'Punch Out' : `Punch Out${!isHalfDayComplete ? ' (min 4h)' : ''}`}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Card 1b: Overtime Slot — only visible after punch-out when 8h worked */}
            {showOvertimeCard && (
            <div className="relative overflow-hidden min-h-[220px]">
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

                {isMobile ? (
                  <div className="flex flex-col gap-3 p-4 bg-indigo-50/50 rounded-[14px] border border-indigo-100/50 mt-2">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Monitor size={18} />
                      <span className="text-[11px] font-black uppercase tracking-tight">Desktop Only Feature</span>
                    </div>
                    <p className="text-[11px] font-bold text-indigo-800 leading-tight">
                      Overtime actions are only available on desktop.
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
            )}

            {/* Card 2: Lunch Break (Visible anytime during active shift until completed) */}
            <div className={`transition-all duration-500 ${isPunchedIn && !isCompleted && !record?.lunch_end_time ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none hidden'}`}>
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

                {isMobile ? (
                  <div className="flex flex-col gap-3 p-4 bg-amber-50/50 rounded-[14px] border border-amber-100 mt-2">
                    <div className="flex items-center gap-2 text-amber-600">
                      <Monitor size={18} />
                      <span className="text-[11px] font-black uppercase tracking-tight">Desktop Only Feature</span>
                    </div>
                    <p className="text-[11px] font-bold text-amber-800 leading-tight">
                      Lunch breaks must be managed on desktop.
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
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


                {/* Blockers */}
                <div className="mb-7">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Blockers</label>
                  <textarea
                    name="blockers" className="form-input-premium" placeholder="Any blockers or challenges faced..."
                    value={reportData.blockers} onChange={handleReportChange} style={{ resize: 'none', minHeight: '110px' }}
                  />
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
                  <span className={`status-dot ${member.is_online ? 'online' : 'offline'}`} />
                </div>
              ))}
            </div>
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
