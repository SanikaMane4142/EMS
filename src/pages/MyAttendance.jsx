import React, { useState } from "react";
import { Calendar, CheckCircle2, Clock, CalendarDays, TrendingUp, LayoutGrid, List, ChevronLeft, ChevronRight, Utensils, Eye, X, Star, FileText, AlertCircle } from "lucide-react";
import { Box, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip, IconButton, Avatar, Typography } from '@mui/material';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useAttendanceHistory, useSubmitAbsenceReason } from '../hooks/useAttendance';
import { useMyLeaves } from '../hooks/useLeaves';
import { toast } from 'react-hot-toast';
import { reportService } from '../services/reportService';
import { useQuery } from '@tanstack/react-query';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtTime = (isoStr) =>
  isoStr ? new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

const lunchMinutes = (row) => {
  if (row.lunch_duration_ms) return Math.round(row.lunch_duration_ms / 60000);
  return null;
};

const lunchStartTime = (row) =>
  row.lunch_start_time ? fmtTime(row.lunch_start_time) : null;

// ── Calendar View ──────────────────────────────────────────────────────────────

const statusColor = (status) => {
  if (!status) return { bg: '#ffffff', text: '#94a3b8', dot: '#cbd5e1', border: '#E2E8F0' };
  
  const colors = {
    punched_out:      { bg: '#DCFCE7', text: '#166534', dot: '#22C55E', border: '#DCFCE7' },
    auto_punched_out: { bg: '#DCFCE7', text: '#166534', dot: '#22C55E', border: '#DCFCE7' },
    punched_in:       { bg: '#E0E7FF', text: '#4338CA', dot: '#6366F1', border: '#E0E7FF' },
    on_leave:         { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', border: '#FEF3C7' },
    absent_unjustified: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', border: '#FEE2E2' },
    absent_explanation_pending: { bg: '#F3F4F6', text: '#475569', dot: '#94A3B8', border: '#F3F4F6' },
    absent_explained:           { bg: '#F3F4F6', text: '#475569', dot: '#94A3B8', border: '#F3F4F6' },
  };

  return colors[status] || { bg: '#ffffff', text: '#64748b', dot: '#94a3b8', border: '#E2E8F0' };
};

const CalendarView = ({ history }) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const byDate = {};
  history.forEach(row => { byDate[row.attendance_date] = row; });

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const monthName = firstDayOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells = [];
  for (let b = 0; b < startWeekday; b++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="p-6">
      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={prevMonth}
          className="w-10 h-10 rounded-2xl border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-all shadow-sm hover:shadow-md"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{monthName}</h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Monthly Overview</p>
        </div>
        <button
          onClick={nextMonth}
          className="w-10 h-10 rounded-2xl border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-all shadow-sm hover:shadow-md"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day Labels */}
      <div className="grid grid-cols-7 gap-3 mb-3">
        {weekdays.map(w => (
          <div key={w} className="text-center text-[12px] font-black uppercase tracking-wider text-slate-500 pb-2">
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-[12px]">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;

          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const row = byDate[dateStr];
          const isToday = dateStr === today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const colors = statusColor(row?.status);
          const lunchMin = row ? lunchMinutes(row) : null;

          return (
            <div
              key={dateStr}
              className="group relative rounded-[20px] transition-all duration-300 border bg-white cursor-default"
              style={{
                borderColor: isToday ? '#6366F1' : (row ? colors.border : '#E2E8F0'),
                minHeight: '118px',
                height: 'auto',
                padding: '14px 14px 12px',
                boxShadow: isToday 
                  ? '0 0 0 4px rgba(99,102,241,0.08), 0 2px 8px rgba(15,23,42,0.04)' 
                  : '0 2px 8px rgba(15,23,42,0.04)',
                backgroundColor: row ? colors.bg : '#ffffff',
              }}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[20px] font-extrabold leading-none ${isToday ? 'text-[#6366F1]' : (row ? colors.text : 'text-slate-400')}`}
                >
                  {day}
                </span>
                {row && (
                  <span
                    className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                    style={{ backgroundColor: colors.dot }}
                  />
                )}
              </div>

              {row ? (
                <div className="flex flex-col flex-1">
                  {/* Punch Stats */}
                  <div className="flex flex-col gap-[6px]">
                    {row.punch_in_time && (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[12px] font-semibold text-slate-600">
                          {fmtTime(row.punch_in_time)}
                        </span>
                      </div>
                    )}
                    {row.punch_out_time && (
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-slate-400 rotate-90 shrink-0" />
                        <span className="text-[12px] font-semibold text-slate-600">
                          {fmtTime(row.punch_out_time)}
                        </span>
                      </div>
                    )}
                    {lunchMin !== null && lunchMin > 0 && (
                      <div className="flex items-center gap-2">
                        <Utensils size={14} className="text-amber-500 shrink-0" />
                        <span className="text-[11px] font-bold text-amber-600">
                          {lunchMin}m break
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Duration pinned to bottom */}
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    {row.total_hours > 0 && (
                      <span className="text-[13px] font-bold text-[#059669]">
                        {row.total_hours}h
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-10 transition-opacity">
                  <Calendar size={32} className="text-slate-200" />
                </div>
              )}

              {/* Hover Effect Layer */}
              <div className="absolute inset-0 rounded-[20px] pointer-events-none transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5" />
            </div>
          );
        })}
      </div>

      {/* Modern Legend */}
      <div className="flex flex-wrap gap-5 mt-10 p-5 bg-slate-50/50 rounded-3xl border border-slate-100 justify-center">
        {[
          { label: 'Present', color: '#22C55E' },
          { label: 'Shift Active', color: '#6366F1' },
          { label: 'On Leave', color: '#F59E0B' },
          { label: 'Absent', color: '#EF4444' },
          { label: 'Pending', color: '#94A3B8' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const MyAttendance = () => {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState('month');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [absenceReason, setAbsenceReason] = useState('');
  
  // Work report modal states
  const [selectedReport, setSelectedReport] = useState(null);
  const [fetchingReport, setFetchingReport] = useState(false);

  // Fetch report history for this employee to show submission status
  const { data: reportHistory = [] } = useQuery({
    queryKey: ['reports', 'history', user?.id],
    queryFn: () => reportService.getReportHistory(user?.id, 100),
    enabled: !!user?.id,
  });

  const submittedReportDates = new Set(reportHistory.map(r => r.report_date));

  const handleViewReport = async (date) => {
    try {
      setFetchingReport(true);
      const report = await reportService.getReportByDateForUser(user.id, date);
      if (report) {
        setSelectedReport(report);
      } else {
        toast.error('No work report submitted for this date.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to fetch report');
    } finally {
      setFetchingReport(false);
    }
  };

  const getFilterParams = (f) => {
    switch (f) {
      case 'week': {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        return { startDate: monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) };
      }
      case 'month': {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: firstDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) };
      }
      case '30days':
        return { days: 30 };
      default:
        return { limit: 10 };
    }
  };

  const { data: history = [], isLoading: historyLoading } = useAttendanceHistory(user?.id, getFilterParams(filter));
  const { data: myLeaves = [] } = useMyLeaves(user?.id);
  const submitAbsenceReasonMutation = useSubmitAbsenceReason();

  const approvedLeaves = myLeaves.filter(l => l.status === 'approved').length;
  const daysPresent = history.filter(h => ['punched_in', 'punched_out', 'auto_punched_out'].includes(h.status)).length;
  const totalHours = history.reduce((acc, h) => acc + (h.total_hours || 0), 0).toFixed(1);

  const stats = [
    { label: "Days Present", value: historyLoading ? '...' : daysPresent.toString(), icon: CheckCircle2, color: "#10b981", bg: "#ecfdf5" },
    { label: "Total Hours", value: historyLoading ? '...' : `${totalHours}h`, icon: Clock, color: "#4f46e5", bg: "#eef2ff" },
    { label: "Leaves Taken", value: historyLoading ? '...' : approvedLeaves.toString(), icon: CalendarDays, color: "#ef4444", bg: "#fef2f2" },
    { label: "Avg. Daily", value: historyLoading ? '...' : (daysPresent > 0 ? (totalHours / daysPresent).toFixed(1) + 'h' : '0h'), icon: TrendingUp, color: "#8b5cf6", bg: "#f5f3ff" },
  ];

  const statusBadgeClass = (status) => {
    if (status === 'punched_in') return 'info';
    if (status === 'punched_out' || status === 'auto_punched_out') return 'success';
    if (status === 'on_leave') return 'info';
    if (status === 'absent_unjustified') return 'danger';
    if (status === 'absent_explanation_pending') return 'warning';
    if (status === 'absent_explained') return 'warning';
    return 'warning';
  };

  const statusLabel = (status) => {
    const labels = {
      punched_in: 'punched in',
      punched_out: 'punched out',
      auto_punched_out: 'auto punched out',
      on_leave: 'on leave',
      absent_unjustified: 'absent !',
      absent_explanation_pending: 'reason pending',
      absent_explained: 'absent explained',
    };
    return labels[status] || status?.replaceAll('_', ' ');
  };

  const openReasonDialog = (row) => {
    setSelectedAttendance(row);
    setAbsenceReason('');
    setReasonDialogOpen(true);
  };

  const handleSubmitReason = async () => {
    if (!selectedAttendance?.id) return;
    if (!absenceReason.trim()) { toast.error('Please provide a reason.'); return; }
    try {
      await submitAbsenceReasonMutation.mutateAsync({
        attendanceId: selectedAttendance.id,
        userId: user.id,
        reason: absenceReason.trim(),
      });
      toast.success('Reason submitted for review.');
      setReasonDialogOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to submit reason.');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="My Attendance" subtitle="Track your daily presence and work hours" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <StatCard key={i} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color} bgColor={stat.bg} />
        ))}
      </div>

      {/* History Panel */}
      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Attendance History</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-100">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <List size={13} /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid size={13} /> Calendar
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
              <select
                className="form-input-premium !w-40 !h-10 !text-xs !py-0 !bg-slate-50 border-none cursor-pointer hover:bg-slate-100 transition-colors"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="10">Last 10 Records</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' ? (
          historyLoading ? (
            <div className="p-6 grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: 2 }} />)}
            </div>
          ) : (
            <CalendarView history={history} />
          )
        ) : (
          /* List / Table View */
          <div className="table-responsive">
            <table className="table-ems" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}></th>
                  <th>Date</th>
                  <th>Punch In</th>
                  <th>Punch Out</th>
                  <th>
                    <div className="flex items-center gap-1">
                      <Utensils size={12} className="text-amber-400" />
                      Lunch Break
                    </div>
                  </th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Report Status</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Reports</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      <td colSpan="9"><Skeleton height={40} /></td>
                    </tr>
                  ))
                ) : history.length === 0 ? (
                  <tr><td colSpan="9" className="text-center p-8 text-slate-400">No history found</td></tr>
                ) : history.map((row, i) => {
                  const lunchMin = lunchMinutes(row);
                  const lunchStart = lunchStartTime(row);
                  return (
                    <tr key={i}>
                      <td>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                          <Calendar size={18} />
                        </div>
                      </td>
                      <td className="text-sm font-bold text-slate-700">
                        {new Date(row.attendance_date + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="text-sm font-medium text-slate-600">
                        {fmtTime(row.punch_in_time)}
                      </td>
                      <td className="text-sm font-medium text-slate-600">
                        {fmtTime(row.punch_out_time)}
                      </td>
                      <td>
                        {lunchStart || lunchMin ? (
                          <Tooltip
                            title={
                              <div className="p-1">
                                <p className="font-bold border-b border-white/20 mb-1 pb-1">Lunch Details</p>
                                <p className="text-xs">Start: {lunchStart || '-'}</p>
                                <p className="text-xs">End: {row.lunch_end_time ? fmtTime(row.lunch_end_time) : (row.lunch_start_time ? 'Active' : '-')}</p>
                              </div>
                            }
                            arrow
                            placement="top"
                          >
                            <div className="flex flex-col gap-0.5 cursor-help">
                              {lunchStart && (
                                <div className="flex items-center gap-1">
                                  <Utensils size={10} className="text-amber-500" />
                                  <span className="text-xs font-medium text-amber-600">{lunchStart}</span>
                                </div>
                              )}
                              {lunchMin !== null && lunchMin > 0 && (
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest pl-4">
                                  {lunchMin} min
                                </span>
                              )}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-300 text-sm">--</span>
                        )}
                      </td>
                      <td className="text-sm font-bold text-slate-900">
                        {row.total_hours ? `${row.total_hours}h` : row.status === 'punched_in' ? 'Ongoing' : '--'}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`badge-pill ${statusBadgeClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                          {row.status === 'absent_unjustified' && (
                            <button
                              className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-wider"
                              onClick={() => openReasonDialog(row)}
                            >
                              Provide Reason
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {['punched_in', 'punched_out', 'auto_punched_out'].includes(row.status) ? (
                          submittedReportDates.has(row.attendance_date) ? (
                            <span className="badge-pill success">Submitted</span>
                          ) : (
                            <span className="badge-pill danger">Not Submitted</span>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold">N/A</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex justify-end items-center">
                          <Tooltip title="View Daily Report">
                            <button
                              className="flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm disabled:opacity-50"
                              style={{ width: 38, height: 38 }}
                              onClick={() => handleViewReport(row.attendance_date)}
                              disabled={fetchingReport || row.status === 'on_leave' || row.status === 'absent_unjustified'}
                            >
                              <Eye size={18} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Box>

      {/* Absence Reason Dialog */}
      <Dialog open={reasonDialogOpen} onClose={() => setReasonDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Submit Absence Reason</DialogTitle>
        <DialogContent>
          <div className="pt-2">
            <p className="text-xs text-slate-500 mb-3">This reason will be reviewed by HR/Admin.</p>
            <TextField
              multiline minRows={4} fullWidth
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              placeholder="Explain why you were absent on this day..."
            />
          </div>
        </DialogContent>
        <DialogActions>
          <button className="btn-ems btn-ems-secondary" onClick={() => setReasonDialogOpen(false)}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={handleSubmitReason} disabled={submitAbsenceReasonMutation.isPending}>
            {submitAbsenceReasonMutation.isPending ? 'Submitting...' : 'Submit Reason'}
          </button>
        </DialogActions>
      </Dialog>

      {/* Report Detail Modal */}
      <Dialog
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: { sx: { backdropFilter: 'blur(8px)', bgcolor: 'rgba(15, 23, 42, 0.3)' } },
          paper: { sx: { borderRadius: '32px', overflow: 'hidden', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxWidth: 1000 } }
        }}
      >
        {selectedReport && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 500 }}>
            {/* LEFT SIDEBAR */}
            <Box sx={{
              width: { xs: '100%', md: 320 },
              bgcolor: '#f8fafc',
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{ mb: 5 }}>
                <Avatar sx={{
                  width: 64, height: 64, bgcolor: '#6366f1',
                  fontWeight: 900, fontSize: 24, mb: 2,
                  boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                }}>
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </Avatar>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', lineHeight: 1, mb: 0.5 }}>
                  {profile?.full_name || 'Employee'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                  Daily Work Report
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#4f46e5', mt: 1 }}>
                  {new Date(selectedReport.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', zIndex: 1 }}>
                {/* Productivity Card */}
                <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <Star size={20} color="#6366f1" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Productivity Score</Typography>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 900, color: '#0f172a' }}>{selectedReport.productivity_rating || 0} / 10</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star} size={12}
                          fill={star <= Math.round((selectedReport.productivity_rating || 0) / 2) ? "#f59e0b" : "none"}
                          color={star <= Math.round((selectedReport.productivity_rating || 0) / 2) ? "#f59e0b" : "#e2e8f0"}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>

                {/* Hours Card */}
                <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={20} color="#8b5cf6" />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hours Invested</Typography>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 900, color: '#0f172a' }}>{selectedReport.total_working_hours || 0} hrs</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* RIGHT CONTENT */}
            <Box sx={{ 
              flex: 1, 
              bgcolor: '#ffffff', 
              p: { xs: 3, md: 5 }, 
              display: 'flex', 
              flexDirection: 'column',
              maxHeight: '85vh' 
            }}>
              {/* Scrollable Content Area */}
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 1,
                overflowY: 'auto',
                pr: 2,
                mr: -2,
                '&::-webkit-scrollbar': { width: '5px' },
                '&::-webkit-scrollbar-track': { background: '#f8fafc' },
                '&::-webkit-scrollbar-thumb': { background: '#e2e8f0', borderRadius: '10px' },
                '&::-webkit-scrollbar-thumb:hover': { background: '#cbd5e1' }
              }}>
                {[
                  { label: 'Tasks Planned Today', value: selectedReport.tasks_planned, icon: Calendar, color: '#3b82f6' },
                  { label: 'Tasks Completed', value: selectedReport.tasks_completed, icon: CheckCircle2, color: '#10b981' },
                  { label: 'Blockers / Notes', value: selectedReport.additional_notes || 'No blockers reported', icon: AlertCircle, color: '#f59e0b' },
                  { label: 'Work In Progress', value: selectedReport.work_in_progress || 'N/A', icon: TrendingUp, color: '#60a5fa' },
                  { label: 'Tomorrow\'s Plan', value: selectedReport.tomorrow_plan, icon: Calendar, color: '#6366f1' },
                ].map((item, idx) => (
                  <Box key={idx} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 2.5, p: 2,
                    borderRadius: '20px', '&:hover': { bgcolor: '#f8fafc' },
                    transition: 'background-color 0.2s'
                  }}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%',
                      bgcolor: item.color, color: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 10px ${item.color}33`,
                      flexShrink: 0,
                      mt: 0.5
                    }}>
                      <item.icon size={18} />
                    </Box>
                    <Box sx={{
                      flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5,
                      borderBottom: idx === 4 ? 'none' : '1px solid #f1f5f9', pb: 2
                    }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 5, pt: 3, borderTop: '1px solid #f1f5f9' }}>
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    backgroundColor: '#eef2ff', color: '#4f46e5',
                    padding: '10px 24px', borderRadius: '12px',
                    fontSize: '0.75rem', fontWeight: 700, border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedReport(null)}
                >
                  <X size={14} /> Close View
                </button>
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>
    </div>
  );
};

export default MyAttendance;