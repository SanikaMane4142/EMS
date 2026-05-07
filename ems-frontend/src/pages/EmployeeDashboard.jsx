import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, Avatar, Chip, Skeleton, Modal, TextField, Typography, Button } from '@mui/material';
import { Clock, Play, Square, CheckCircle, AlertTriangle, Users, Calendar, FileText, Send, Save, ChevronRight, CheckSquare } from 'lucide-react';
import StatCard from '../components/StatCard';
import { attendanceService } from '../services/attendanceService';
import { profileService } from '../services/profileService';
import { reportService } from '../services/reportService';
import { leaveService } from '../services/leaveService';

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
const HALF_DAY_MS = 4 * 60 * 60 * 1000; // 4 hours
const LUNCH_LIMIT_MS = 60 * 60 * 1000; // 1 hour

// ─── Component ────────────────────────────────────────────────────────────────
const EmployeeDashboard = () => {
  const { user, profile } = useAuth();

  // Attendance state — Supabase record is the SINGLE source of truth
  const [record, setRecord] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lunchElapsedMs, setLunchElapsedMs] = useState(0);

  // UI loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Secondary data
  const [team, setTeam] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(12);
  const [reportData, setReportData] = useState({
    tasks_planned: '',
    tasks_completed: '',
    work_in_progress: '',
    tomorrow_plan: '',
    total_working_hours: 8,
    productivity_rating: 5,
    additional_notes: ''
  });
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Late Resume Modal State
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeReason, setResumeReason] = useState('');

  // Timer interval ref
  const timerRef = useRef(null);

  // ── Start / Stop the live ticker ──────────────────────────────────────────
  const startTimer = (rec) => {
    stopTimer();
    // Immediately set elapsed so the display doesn't flicker to 00:00
    setElapsedMs(calcElapsedMs(rec));
    if (rec?.lunch_start_time) {
      setLunchElapsedMs(Date.now() - new Date(rec.lunch_start_time).getTime());
    } else {
      setLunchElapsedMs(0);
    }

    timerRef.current = setInterval(() => {
      setElapsedMs(calcElapsedMs(rec));
      if (rec?.lunch_start_time) {
        setLunchElapsedMs(Date.now() - new Date(rec.lunch_start_time).getTime());
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), []);

  // ── Apply record and drive timer accordingly ──────────────────────────────
  const applyRecord = (rec) => {
    setRecord(rec);
    if (rec?.status === 'punched_in' && rec.punch_in_time) {
      // Restore timer from Supabase punch_in_time — works after logout/refresh
      startTimer(rec);
    } else if (rec?.punch_in_time && rec?.punch_out_time) {
      // Completed shift — show total duration, no live tick
      stopTimer();
      const diffMs = new Date(rec.punch_out_time) - new Date(rec.punch_in_time);
      setElapsedMs(Math.max(0, diffMs - (rec.lunch_duration_ms || 0)));
      setLunchElapsedMs(0);
    } else {
      stopTimer();
      setElapsedMs(0);
      setLunchElapsedMs(0);
    }
  };

  // ── Fetch all dashboard data on mount ────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // ── STEP 1: Fetch attendance FIRST, apply immediately ──────────────
        const attendanceRecord = await attendanceService.getActiveRecord(user.id);
        console.log('[Dashboard] Attendance record:', attendanceRecord);
        applyRecord(attendanceRecord);
      } catch (err) {
        console.error('[Dashboard] Critical fetch error:', err);
      } finally {
        setLoading(false);
      }

      // ── STEP 2: Fetch all secondary data in parallel ───────────────────
      try {
        const [historyRes, myTeam, upcomingBirthdays, todayReport, myLeaves] = await Promise.allSettled([
          attendanceService.getAttendanceHistory(user.id, 5),
          profileService.getDepartmentMembers(profile?.department_id),
          profileService.getUpcomingBirthdays(),
          reportService.getTodayReport(user.id),
          leaveService.getMyLeaves(user.id),
        ]);

        setHistory(historyRes.status === 'fulfilled' ? (historyRes.value || []) : []);
        setTeam(myTeam.status === 'fulfilled' ? (myTeam.value || []) : []);
        setBirthdays(upcomingBirthdays.status === 'fulfilled' ? (upcomingBirthdays.value || []) : []);

        if (todayReport.status === 'fulfilled' && todayReport.value) {
          setReportData(todayReport.value);
          setReportSubmitted(true);
        }

        if (myLeaves.status === 'fulfilled') {
          const approved = (myLeaves.value || []).filter(l => l.status === 'approved').length;
          setLeaveBalance(15 - approved);
        }
      } catch (err) {
        console.error('[Dashboard] Secondary fetch error:', err);
      }
    };

    fetchData();
  }, [user?.id, profile?.department_id]); // Re-fetch if user or department changes

  // ── Derived state ─────────────────────────────────────────────────────────
  const isPunchedIn = record?.status === 'punched_in';
  const isCompleted = record?.status === 'punched_out' || record?.status === 'auto_punched_out';
  const isLunchBreak = record?.lunch_start_time != null;
  const isShiftComplete = elapsedMs >= SHIFT_MS;
  const isHalfDayComplete = elapsedMs >= HALF_DAY_MS;
  const remainingMs = Math.max(0, SHIFT_MS - elapsedMs);
  const isLunchExceeded = isLunchBreak && lunchElapsedMs >= LUNCH_LIMIT_MS;

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
    ? formatMs(elapsedMs) // elapsedMs was set to punch_out - punch_in
    : '00:00:00';

  const borderColor = isPunchedIn ? (isLunchBreak ? (isLunchExceeded ? '#ef4444' : '#8b5cf6') : '#10b981') : isCompleted ? '#3b82f6' : '#f59e0b';

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePunchIn = async () => {
    try {
      setActionLoading(true);
      const newRecord = await attendanceService.punchIn(user.id);
      applyRecord(newRecord);
      setHistory(prev => [newRecord, ...prev.slice(0, 4)]);
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
      const updated = await attendanceService.punchOut(record.id, record.punch_in_time, record.lunch_duration_ms || 0);
      applyRecord(updated);
      setHistory(prev => prev.map(h => (h.id === updated.id ? updated : h)));
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
      const updated = await attendanceService.autoPunchOut(record.id, record.punch_in_time, record.lunch_duration_ms || 0);
      applyRecord(updated);
      setHistory(prev => prev.map(h => (h.id === updated.id ? updated : h)));
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
      const updated = await attendanceService.startLunchBreak(record.id);
      applyRecord(updated);
      setHistory(prev => prev.map(h => (h.id === updated.id ? updated : h)));
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
      const updated = await attendanceService.endLunchBreak(record.id, record.lunch_start_time, record.lunch_duration_ms || 0, reason);
      applyRecord(updated);
      setHistory(prev => prev.map(h => (h.id === updated.id ? updated : h)));
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

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await reportService.submitDailyReport(user.id, reportData);
      setReportSubmitted(true);
      // Success feedback
      const Toast = (await import('sweetalert2')).default.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
      Toast.fire({ icon: 'success', title: 'Today’s report submitted successfully.' });
    } catch (err) {
      console.error('Report submission failed:', err);
      alert('Report submission failed: ' + err.message);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard title="Attendance Rate" value={loading ? '...' : '98%'} icon={Calendar} color="#4f46e5" bgColor="#eef2ff" trend="up" trendValue="+2%" />
        <StatCard title="Avg. Working Hours" value={loading ? '...' : '8.2h'} icon={Clock} color="#10b981" bgColor="#ecfdf5" />
        <StatCard title="Reports Submitted" value={loading ? '...' : `${history.length}`} icon={FileText} color="#f59e0b" bgColor="#fffbeb" />
        <StatCard title="Pending Tasks" value="3" icon={CheckCircle} color="#8b5cf6" bgColor="#f5f3ff" onClick={() => navigate('/my-tasks')} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* ── Attendance Status Card ── */}
          <Box className="card-ems-static" sx={{ p: 3, borderLeft: `5px solid ${borderColor}` }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

              {/* Left: status text */}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Status</span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${isPunchedIn ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={isPunchedIn ? { animation: 'pulseDot 2s infinite' } : {}}
                  />
                  <h2 className="text-xl font-extrabold text-slate-900">{statusLabel}</h2>
                </div>
                {record?.punch_in_time && (
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Punched in at {new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {isCompleted && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1">
                    ✓ Attendance completed for today
                  </p>
                )}
              </div>

              {/* Center: Timer */}
              <div className="flex flex-col items-center">
                <div
                  className={`text-3xl font-extrabold tracking-tight ${isLunchBreak ? (isLunchExceeded ? 'text-red-600' : 'text-purple-600') : 'text-slate-900'}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {isLunchBreak ? formatMs(lunchElapsedMs) : timerDisplay}
                </div>
                {isLunchBreak && !isLunchExceeded && (
                  <span className="text-[10px] font-bold text-purple-500 mt-1 uppercase tracking-tighter">
                    Lunch Break ({formatMs(Math.max(0, LUNCH_LIMIT_MS - lunchElapsedMs))} remaining)
                  </span>
                )}
                {isLunchExceeded && (
                  <span className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-tighter">
                    Lunch Limit Exceeded! Please resume work.
                  </span>
                )}
                {isPunchedIn && !isLunchBreak && !isHalfDayComplete && (
                  <span className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-tighter">
                    {formatMs(Math.max(0, HALF_DAY_MS - elapsedMs))} until half-day
                  </span>
                )}
                {isPunchedIn && !isLunchBreak && isHalfDayComplete && !isShiftComplete && (
                  <span className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-tighter">
                    {formatMs(remainingMs)} remaining for full shift
                  </span>
                )}
                {isPunchedIn && !isLunchBreak && isShiftComplete && (
                  <span className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-tighter">
                    Shift complete — auto punch out available
                  </span>
                )}
              </div>

              {/* Right: Action button */}
              <div className="flex flex-col gap-2 sm:items-end">
                {isLunchBreak ? (
                  <button
                    className={`btn-ems ${isLunchExceeded ? 'btn-ems-danger' : 'btn-ems-primary'}`}
                    onClick={onResumeClick}
                    disabled={loading || actionLoading}
                    style={{ minWidth: 160, height: 48, background: isLunchExceeded ? '#ef4444' : '#8b5cf6', color: '#fff', border: 'none' }}
                  >
                    {actionLoading ? 'Please wait...' : <><Play size={18} /> Resume Work</>}
                  </button>
                ) : (
                  <>
                    <button
                      className={`btn-ems ${!record ? 'btn-ems-success' : isPunchedIn ? 'btn-ems-danger' : 'btn-ems-secondary'}`}
                      onClick={!record ? handlePunchIn : isPunchedIn ? (isShiftComplete ? handleAutoPunchOut : handlePunchOut) : undefined}
                      disabled={
                        loading ||
                        actionLoading ||
                        isCompleted ||
                        (isPunchedIn && !isHalfDayComplete)
                      }
                      style={{ minWidth: 160, height: 48 }}
                    >
                      {actionLoading
                        ? 'Please wait...'
                        : !record
                        ? <><Play size={18} /> Punch In</>
                        : isPunchedIn
                        ? (isShiftComplete ? <><Square size={18} /> Auto Punch Out</> : <><Square size={18} /> Punch Out</>)
                        : <><CheckCircle size={18} /> Done for Today</>}
                    </button>
                    {isPunchedIn && !isCompleted && !record?.lunch_end_time && (
                      <button
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold text-amber-900 bg-gradient-to-r from-amber-200 to-amber-400 hover:from-amber-300 hover:to-amber-500 shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md"
                        onClick={handleStartLunch}
                        disabled={loading || actionLoading || isShiftComplete}
                        style={{ minWidth: 160, height: 38, fontSize: '0.85rem' }}
                      >
                        <Clock size={16} /> Start Lunch Break
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </Box>

          {/* ── Daily Report ── */}
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} /> Daily Work Report
              </h3>
              {reportSubmitted && (
                <span className="badge-pill success flex items-center gap-1">
                  <CheckCircle size={13} /> Submitted
                </span>
              )}
            </div>

            {!reportSubmitted ? (
              <form onSubmit={handleReportSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Column 1: Planned and Completed */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Tasks Planned Today</label>
                      <textarea
                        name="tasks_planned" className="form-input-ems" placeholder="List tasks planned for today..."
                        value={reportData.tasks_planned} onChange={handleReportChange} rows="3" style={{ resize: 'none' }} required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Tasks Completed</label>
                      <textarea
                        name="tasks_completed" className="form-input-ems" placeholder="List completed tasks..."
                        value={reportData.tasks_completed} onChange={handleReportChange} rows="3" style={{ resize: 'none' }} required
                      />
                    </div>
                  </div>

                  {/* Column 2: WIP and Tomorrow */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Work In Progress</label>
                      <textarea
                        name="work_in_progress" className="form-input-ems" placeholder="Mention ongoing tasks..."
                        value={reportData.work_in_progress} onChange={handleReportChange} rows="3" style={{ resize: 'none' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Tomorrow Plan</label>
                      <textarea
                        name="tomorrow_plan" className="form-input-ems" placeholder="Plan for tomorrow..."
                        value={reportData.tomorrow_plan} onChange={handleReportChange} rows="3" style={{ resize: 'none' }} required
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Total Working Hours</label>
                    <input
                      type="number" name="total_working_hours" className="form-input-ems"
                      min="0" max="24" step="0.5" value={reportData.total_working_hours} onChange={handleReportChange} required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Productivity Rating (1-10)</label>
                    <select
                      name="productivity_rating" className="form-select-ems"
                      value={reportData.productivity_rating} onChange={handleReportChange}
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} - {n <= 3 ? 'Low' : n <= 7 ? 'Good' : 'Excellent'}</option>)}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Additional Notes</label>
                  <textarea
                    name="additional_notes" className="form-input-ems" placeholder="Any extra notes..."
                    value={reportData.additional_notes} onChange={handleReportChange} rows="2" style={{ resize: 'none' }}
                  />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="btn-ems btn-ems-primary flex-1" disabled={actionLoading}>
                    <Send size={16} /> {actionLoading ? 'Submitting...' : 'Submit Today’s Report'}
                  </button>
                  <button type="button" className="btn-ems btn-ems-secondary" style={{ width: 130 }} onClick={() => alert('Draft saved locally (Coming Soon)')}>
                    <Save size={16} /> Save Draft
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

          {/* Team Status */}
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} /> Team Status
              </h3>
              <span className="badge-pill info">{team.length} Members</span>
            </div>
            <div className="flex flex-col gap-3">
              {loading ? (
                [1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: '12px' }} />)
              ) : team.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No team members found</p>
              ) : team.map((member, i) => (
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
