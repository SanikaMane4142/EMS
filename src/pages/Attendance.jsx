import React, { useState, useMemo, useEffect } from 'react';
import { Box, Avatar, Modal, Tooltip } from '@mui/material';
import {
  UserCheck, UserX, Clock, Download, Calendar, Search,
  MapPin, Plane, ArrowUpRight, Check, X,
  TrendingUp, RefreshCw, ChevronLeft, ChevronRight,
  LogOut, AlertTriangle, Info, FileText, Shield
} from 'lucide-react';
import { utils, writeFile, write } from 'xlsx';
import PageHeader from '../components/PageHeader';
import {
  useAttendanceOverview, usePendingAbsenceExplanations, useReviewAbsenceExplanation,
  useAuthorizedEarlyPunchOut, useOverrideLogs,
  usePendingEarlyExitRequests, useReviewEarlyExitRequest
} from '../hooks/useAttendance';
import { useDepartments } from '../hooks/useDepartments';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';

// --- Timer Helpers ---
const formatMs = (ms) => {
  if (!ms || ms < 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
};

const calcElapsedMs = (rec, nowTick) => {
  if (!rec?.punch_in_time) return 0;
  const now = nowTick || Date.now();
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

const getDurationString = (row, nowTick) => {
  if (row.rawStatus === 'punched_in') {
    const ms = calcElapsedMs(row, nowTick);
    return formatMs(ms);
  } else if (row.punch_in_time && row.punch_out_time) {
    const diffMs = new Date(row.punch_out_time) - new Date(row.punch_in_time);
    const ms = Math.max(0, diffMs - (row.lunch_duration_ms || 0));
    return formatMs(ms);
  }
  return '--';
};


// --- Styled Components / Constants ---
const STATUS_CONFIG = {
  'Present': { color: '#10b981', bg: '#ecfdf5', label: 'Present', icon: UserCheck },
  'Late': { color: '#f59e0b', bg: '#fffbeb', label: 'Late', icon: Clock },
  'Absent': { color: '#ef4444', bg: '#fef2f2', label: 'Absent', icon: UserX },
  'Absent !': { color: '#ef4444', bg: '#fef2f2', label: 'Absent !', icon: UserX },
  'Reason Pending': { color: '#f59e0b', bg: '#fffbeb', label: 'Reason Pending', icon: Clock },
  'Absent Explained': { color: '#eab308', bg: '#fef9c3', label: 'Absent Explained', icon: Clock },
  'On Leave': { color: '#8b5cf6', bg: '#f5f3ff', label: 'On Leave', icon: Plane },
  'Remote': { color: '#3b82f6', bg: '#eff6ff', label: 'Remote', icon: MapPin },
  'Early Exit Approved': { color: '#10b981', bg: '#ecfdf5', label: 'Early Exit Approved', icon: Shield },
  'Early Exit': { color: '#f59e0b', bg: '#fffbeb', label: 'Early Exit', icon: LogOut },
  'Left': { color: '#64748b', bg: '#f1f5f9', label: 'Left', icon: LogOut },
};

const FORCE_PUNCH_OUT_REASONS = [
  'Work completed for today',
  'Medical emergency',
  'Personal emergency',
  'Client meeting / offsite work',
  'Approved flexible timing',
  'Internet/electricity issue',
  'System issue',
  'Shift adjustment',
  'Travel approval',
  'Other',
];

const Attendance = () => {
  const { profile } = useAuth();

  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtering State
  const today = new Date().toLocaleDateString('en-CA');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [empIdSearch, setEmpIdSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: rawAttendance = [], isLoading: loadingAttendance } = useAttendanceOverview({
    startDate,
    endDate,
    dept: deptFilter,
    empId: empIdSearch
  });

  const { data: departments = [] } = useDepartments();
  const { data: pendingExplanations = [] } = usePendingAbsenceExplanations({ startDate, endDate });
  const reviewExplanationMutation = useReviewAbsenceExplanation();
  const earlyPunchOutMutation = useAuthorizedEarlyPunchOut();
  const { data: pendingEarlyExits = [] } = usePendingEarlyExitRequests();
  const reviewEarlyExitMutation = useReviewEarlyExitRequest();

  // Role check for HR/Admin
  const isAdminRole = profile?.role === 'hr' || profile?.role === 'admin' || profile?.role === 'super_admin';

  // Authorized Punch-Out Modal State
  const [punchOutModal, setPunchOutModal] = useState({ open: false, row: null });
  const [punchOutForm, setPunchOutForm] = useState({ reason: '', note: '', markFullDay: false });

  // Override Detail Modal State
  const [detailModal, setDetailModal] = useState({ open: false, row: null });

  // Early Exit Request Review Modal State
  const [reviewEarlyExitModal, setReviewEarlyExitModal] = useState({ open: false, request: null });
  const [reviewEarlyExitForm, setReviewEarlyExitForm] = useState({ note: '', markFullDay: false });

  const handleOpenPunchOutModal = (row) => {
    setPunchOutForm({ reason: '', note: '', markFullDay: false });
    setPunchOutModal({ open: true, row });
  };

  const handleSubmitEarlyPunchOut = async () => {
    if (!punchOutForm.reason) { toast.error('Please select a reason.'); return; }
    if (!punchOutForm.note.trim()) { toast.error('Please enter a note.'); return; }

    const result = await Swal.fire({
      title: 'Confirm Early Punch-Out',
      html: `<p style="font-size:14px;color:#475569;">You are about to punch out <b>${punchOutModal.row?.name}</b> early. Exact punch-out time will be saved. ${punchOutForm.markFullDay ? '<br/><b>Full-day (8h) approval</b> will affect payable hours.' : 'Payable hours will match actual worked hours.'}</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Punch Out',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      await earlyPunchOutMutation.mutateAsync({
        attendanceId: punchOutModal.row.id,
        reason: punchOutForm.reason,
        note: punchOutForm.note.trim(),
        markFullDay: punchOutForm.markFullDay,
      });
      toast.success(`${punchOutModal.row.name} has been punched out.`);
      setPunchOutModal({ open: false, row: null });
    } catch (err) {
      toast.error(err.message || 'Failed to punch out employee.');
    }
  };

  const handleReviewEarlyExit = async (status) => {
    if (status === 'rejected' && !reviewEarlyExitForm.note.trim()) {
      toast.error('Please provide a reason for rejection.');
      return;
    }

    try {
      await reviewEarlyExitMutation.mutateAsync({
        requestId: reviewEarlyExitModal.request.id,
        status,
        reviewerNote: reviewEarlyExitForm.note.trim(),
        markFullDay: reviewEarlyExitForm.markFullDay
      });
      toast.success(`Request ${status} successfully.`);
      setReviewEarlyExitModal({ open: false, request: null });
    } catch (err) {
      toast.error(err.message || 'Failed to review request.');
    }
  };
  const pendingExplanationByAttendanceId = useMemo(
    () => Object.fromEntries((pendingExplanations || []).map((p) => [p.attendance_id, p])),
    [pendingExplanations]
  );

  // Process data and apply derived display status
  const attendance = useMemo(() => {
    return rawAttendance.map(item => {
      let status = item.status;

      // Simulate "Late" if punch-in is after 10:00 AM
      if (item.punchIn !== '-' && item.status === 'Present') {
        try {
          const parts = item.punchIn.split(' ');
          const time = parts[0];
          const modifier = parts[1];

          const [hours, minutes] = time.split(':');
          let h = parseInt(hours);

          if (modifier === 'PM' && h < 12) h += 12;
          if (modifier === 'AM' && h === 12) h = 0;

          if (h > 10 || (h === 10 && parseInt(minutes) > 0)) {
            status = 'Late';
          }
        } catch (e) {
          console.warn('Could not parse time:', item.punchIn);
        }
      }

      return { ...item, displayStatus: status };
    }).filter(item => statusFilter === 'all' || item.displayStatus === statusFilter);
  }, [rawAttendance, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const present = rawAttendance.filter(a => a.status === 'Present' || a.status === 'Left').length;
    const late = attendance.filter(a => a.displayStatus === 'Late').length;
    const activeNow = rawAttendance.filter(a => a.rawStatus === 'punched_in').length;
    const totalHours = rawAttendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0).toFixed(1);

    return {
      present,
      late,
      onLeave: rawAttendance.filter(a => a.rawStatus === 'on_leave').length,
      activeNow,
      totalHours
    };
  }, [rawAttendance, attendance]);

  const hasPendingActions = useMemo(() =>
    attendance.some(row => (row.absenceExplanation?.status === 'pending' || pendingExplanationByAttendanceId[row.id]?.status === 'pending')),
    [attendance, pendingExplanationByAttendanceId]
  );

  const handleReviewReason = async (explanationId, status) => {
    try {
      await reviewExplanationMutation.mutateAsync({ explanationId, status });
      toast.success(status === 'approved' ? 'Reason approved.' : 'Reason rejected.');
    } catch (err) {
      toast.error(err.message || 'Action failed');
    }
  };

  const handleExport = () => {
    if (attendance.length === 0) {
      toast.error('No data to export.');
      return;
    }

    const toastId = toast.loading('Generating report...');

    try {
      const excelData = attendance.map(row => ({
        'Date': row.date,
        'Employee Name': row.name,
        'Emp ID': row.empId,
        'Email': row.email,
        'Status': row.displayStatus,
        'Punch In': row.punchIn,
        'Punch Out': row.punchOut,
        'Actual Work (Hrs)': row.totalHours,
        'Overtime (Hrs)': row.overtime
      }));

      const worksheet = utils.json_to_sheet(excelData);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Attendance_Report');

      // Manual download method
      const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Report_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Download started!', { id: toastId });
      }, 500);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed: ' + error.message, { id: toastId });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">

      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Live Overview</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
            Today Attendance
          </h1>
          <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
            <Calendar size={14} />
            {new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95" onClick={() => window.location.reload()}>
            <RefreshCw size={16} className={loadingAttendance ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50" onClick={handleExport} disabled={attendance.length === 0}>
            <Download size={16} />
            Export Data
          </button>
        </div>
      </div>

      {/* Modern KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Present', value: stats.present, icon: UserCheck, color: 'emerald' },
          { label: 'Late', value: stats.late, icon: Clock, color: 'amber' },
          { label: 'On Leave', value: stats.onLeave, icon: Plane, color: 'indigo' },
          { label: 'Active Now', value: stats.activeNow, icon: TrendingUp, color: 'blue' },
          { label: 'Total Work', value: `${stats.totalHours}h`, icon: ArrowUpRight, color: 'purple' },
        ].map((kpi, i) => (
          <div key={i} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={24} />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mb-1">{loadingAttendance ? '...' : kpi.value}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</div>
          </div>
        ))}
      </div>

      {pendingExplanations.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
          <div className="text-xs font-black text-amber-700 uppercase tracking-wider mb-3">
            Pending Absence Reasons ({pendingExplanations.length})
          </div>
          <div className="flex flex-col gap-2">
            {pendingExplanations.slice(0, 8).map((item) => (
              <div key={item.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {item.employee?.full_name || item.employee?.email || 'Employee'} ({item.employee?.employee_id || '-'})
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.attendance?.attendance_date} - {item.reason}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-ems btn-ems-success"
                    disabled={reviewExplanationMutation.isPending}
                    onClick={() => handleReviewReason(item.id, 'approved')}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    className="btn-ems btn-ems-outline"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    disabled={reviewExplanationMutation.isPending}
                    onClick={() => handleReviewReason(item.id, 'rejected')}
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingEarlyExits.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6">
          <div className="text-xs font-black text-orange-700 uppercase tracking-wider mb-3">
            Pending Early Exit Requests ({pendingEarlyExits.length})
          </div>
          <div className="flex flex-col gap-2">
            {pendingEarlyExits.slice(0, 8).map((req) => (
              <div key={req.id} className="bg-white border border-orange-100 rounded-xl p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {req.employee?.full_name || req.employee?.email || 'Employee'} ({req.employee?.employee_id || '-'})
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    <strong className="text-slate-700">Reason:</strong> {req.reason} — <span className="italic">{req.note}</span>
                  </div>
                </div>
                <button
                  className="btn-ems btn-ems-primary text-xs h-8 px-4 py-0"
                  onClick={() => {
                    setReviewEarlyExitForm({ note: '', markFullDay: false });
                    setReviewEarlyExitModal({ open: true, request: req });
                  }}
                >
                  Review Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Premium Advanced Filter Bar */}
      <div className="bg-white/70 backdrop-blur-2xl sticky top-4 z-30 p-2.5 rounded-[32px] border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)] mb-8 mx-auto max-w-[1400px]">
        <div className="flex flex-col xl:flex-row gap-4 items-center">

          {/* Search Section */}
          <div className="relative group flex-1 w-full xl:w-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            </div>
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              className="w-full pl-11 pr-4 py-3.5 bg-slate-100/50 border border-transparent rounded-[22px] text-sm font-semibold focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none text-slate-700 placeholder:text-slate-400"
              value={empIdSearch}
              onChange={(e) => setEmpIdSearch(e.target.value)}
            />
          </div>

          <div className="hidden xl:block w-[1px] h-10 bg-slate-200/60" />

          {/* Controls Section */}
          <div className="flex flex-wrap items-center justify-center gap-4 w-full xl:w-auto">

            {/* Status Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-[22px] border border-slate-200/20">
              {['all', 'Present', 'Late', 'Absent', 'Reason Pending', 'On Leave'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${statusFilter === status
                      ? 'bg-white text-indigo-600 shadow-[0_4px_12px_rgba(79,70,229,0.12)] border border-indigo-50'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }`}
                >
                  {status === 'all' ? 'All Logs' : status}
                </button>
              ))}
            </div>

            {/* Department Selector */}
            <div className="relative min-w-[160px]">
              <select
                className="w-full appearance-none pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-[22px] text-[10px] font-black uppercase tracking-wider text-slate-600 outline-none cursor-pointer hover:border-indigo-200 transition-all focus:ring-4 focus:ring-indigo-500/5"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="all">Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                <ArrowUpRight size={14} className="rotate-45" />
              </div>
            </div>

            {/* Date Range Glass Picker */}
            <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50/50 border border-indigo-100/50 rounded-[22px]">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-indigo-400" />
                <input
                  type="date"
                  className="bg-transparent border-none text-[10px] font-black text-indigo-600 outline-none cursor-pointer"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="w-4 h-[1px] bg-indigo-200" />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="bg-transparent border-none text-[10px] font-black text-indigo-600 outline-none cursor-pointer"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Premium Hybrid Card Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Employee</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Time</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Punch In</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Punch Out</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lunch</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Overtime</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                {(hasPendingActions || isAdminRole) && <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingAttendance ? (
                // Skeleton loading rows
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={(hasPendingActions || isAdminRole) ? 8 : 7} className="px-8 py-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
                        <div className="space-y-2">
                          <div className="w-48 h-4 bg-slate-100 rounded" />
                          <div className="w-32 h-3 bg-slate-50 rounded" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : attendance.length > 0 ? (
                attendance.map((row) => (
                  <tr key={row.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                    {/* Employee Section */}
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative group/avatar">
                          <Avatar
                            sx={{
                              width: 52, height: 52,
                              borderRadius: '20px',
                              bgcolor: '#f1f5f9',
                              border: '2px solid white',
                              boxShadow: '0 8px 16px -4px rgba(0,0,0,0.08)',
                              fontSize: 18, fontWeight: 900, color: '#475569',
                              transition: 'all 0.3s ease'
                            }}
                            className="group-hover/avatar:scale-105 group-hover/avatar:rotate-3"
                          >
                            {row.name.charAt(0)}
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-[3px] border-white shadow-sm ${row.punchIn !== '-' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div>
                          <div className="text-[14px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight mb-0.5">{row.name}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">{row.dept}</span>
                            <span className="text-[10px] font-medium text-slate-300 lowercase">{row.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Time (Live Timer / Total Shift Duration) */}
                    <td className="px-6 py-5 text-center">
                      {row.rawStatus === 'punched_in' ? (
                        <div className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 font-mono text-[11px] font-black tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{getDurationString(row, timeTick)}</span>
                        </div>
                      ) : ['punched_out', 'auto_punched_out'].includes(row.rawStatus) || (row.punch_in_time && row.punch_out_time) ? (
                        <div className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-100/50 font-mono text-[11px] font-black tracking-wide">
                          <span>{getDurationString(row, timeTick)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs font-semibold">--</span>
                      )}
                    </td>


                    {/* Timing Details */}
                    <td className="px-6 py-5 text-center">
                      <div className="text-[11px] font-black text-slate-700 bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-100/50 inline-block min-w-[80px]">
                        {row.punchIn}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      {row.punchOut === '-' && row.rawStatus === 'punched_in' ? (
                        <div className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Active</span>
                        </div>
                      ) : (
                        <div className={`text-[11px] font-black py-1.5 px-3 rounded-xl border border-slate-100/50 inline-block min-w-[80px] ${row.punchOut === '-' ? 'text-slate-300' : 'text-slate-700 bg-slate-50'}`}>
                          {row.punchOut}
                        </div>
                      )}
                    </td>

                    {/* Lunch */}
                    <td className="px-6 py-5 text-center">
                      <div className={`text-[11px] font-black py-1.5 px-3 rounded-xl inline-block ${row.lunchDuration > 0 ? 'bg-indigo-50/30 text-indigo-600 border border-indigo-100/50' : 'text-slate-200'}`}>
                        {row.lunchDuration > 0 ? `${row.lunchDuration}m` : '--'}
                      </div>
                    </td>

                    {/* Overtime */}
                    <td className="px-6 py-5 text-center">
                      {row.overtime > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="text-[11px] font-black text-emerald-600">+{row.overtime}h</span>
                          <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-tighter">Overtime</span>
                        </div>
                      ) : (
                        <span className="text-slate-200 text-xs">--</span>
                      )}
                    </td>

                    {/* Status Pill */}
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        {row.is_force_punched_out ? (
                          <Tooltip
                            arrow
                            placement="top"
                            title={
                              <div className="p-2 text-xs space-y-1">
                                <p className="font-bold border-b border-white/20 pb-1 mb-1">Early Exit Details</p>
                                <p>Actual: <b>{row.actual_work_hours ?? '-'}h</b></p>
                                <p>Payable: <b>{row.approved_work_hours ?? '-'}h</b></p>
                                <p>Reason: {row.force_punch_out_reason}</p>
                                <p>Note: {row.force_punch_out_note}</p>
                                {row.force_punch_out_at && <p>At: {new Date(row.force_punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                              </div>
                            }
                          >
                            <div
                              className="px-5 py-2.5 rounded-[20px] flex items-center gap-2.5 border shadow-[0_4px_12px_rgba(0,0,0,0.03)] cursor-pointer transition-all group-hover:scale-105 group-hover:shadow-md"
                              style={{
                                backgroundColor: STATUS_CONFIG[row.displayStatus]?.bg || '#f1f5f9',
                                borderColor: `${STATUS_CONFIG[row.displayStatus]?.color}20`,
                                color: STATUS_CONFIG[row.displayStatus]?.color || '#64748b'
                              }}
                              onClick={() => setDetailModal({ open: true, row })}
                            >
                              {(() => {
                                const Icon = STATUS_CONFIG[row.displayStatus]?.icon;
                                return Icon ? <Icon size={14} strokeWidth={3} /> : null;
                              })()}
                              <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                                {row.displayStatus}
                              </span>
                            </div>
                          </Tooltip>
                        ) : (
                          <div
                            className="px-5 py-2.5 rounded-[20px] flex items-center gap-2.5 border shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all group-hover:scale-105 group-hover:shadow-md"
                            style={{
                              backgroundColor: STATUS_CONFIG[row.displayStatus]?.bg || '#f1f5f9',
                              borderColor: `${STATUS_CONFIG[row.displayStatus]?.color}20`,
                              color: STATUS_CONFIG[row.displayStatus]?.color || '#64748b'
                            }}
                          >
                            {(() => {
                              const Icon = STATUS_CONFIG[row.displayStatus]?.icon;
                              return Icon ? <Icon size={14} strokeWidth={3} /> : null;
                            })()}
                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                              {row.displayStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Row Action */}
                    {(hasPendingActions || isAdminRole) && (
                      <td className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Absence review button */}
                          {(row.absenceExplanation?.status === 'pending' || pendingExplanationByAttendanceId[row.id]?.status === 'pending') && (
                            <button
                              className="px-4 py-2 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
                              disabled={reviewExplanationMutation.isPending}
                              onClick={() => handleReviewReason((row.absenceExplanation?.id || pendingExplanationByAttendanceId[row.id]?.id), 'approved')}
                            >
                              <span className="flex items-center gap-1.5">
                                <Check size={12} strokeWidth={3} />
                                Review
                              </span>
                            </button>
                          )}
                          {/* Authorized Punch-Out button — only for active employees */}
                          {isAdminRole && row.rawStatus === 'punched_in' && !row.punch_out_time && !row.is_force_punched_out && (
                            <button
                              className="px-4 py-2 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all hover:shadow-lg hover:shadow-amber-200 active:scale-95 disabled:opacity-50"
                              disabled={earlyPunchOutMutation.isPending}
                              onClick={() => handleOpenPunchOutModal(row)}
                            >
                              <span className="flex items-center gap-1.5">
                                <LogOut size={12} strokeWidth={3} />
                                Early Exit
                              </span>
                            </button>
                          )}
                          {/* Detail view for force-punched-out records */}
                          {isAdminRole && row.is_force_punched_out && (
                            <button
                              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all active:scale-95"
                              onClick={() => setDetailModal({ open: true, row })}
                            >
                              <span className="flex items-center gap-1.5">
                                <Info size={12} strokeWidth={3} />
                                Details
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={(hasPendingActions || isAdminRole) ? 8 : 7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-slate-200" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mb-1">No matches found</h3>
                      <p className="text-sm text-slate-500 max-w-xs">We couldn't find any attendance logs matching your current filters.</p>
                      <button className="mt-6 text-indigo-600 font-bold text-xs uppercase tracking-widest hover:underline" onClick={() => {
                        setEmpIdSearch('');
                        setStatusFilter('all');
                        setDeptFilter('all');
                        setStartDate(today);
                        setEndDate(today);
                      }}>Clear all filters</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Premium Compact Pagination */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400">
            Showing <span className="text-slate-900 font-black">{attendance.length}</span> of <span className="text-slate-900 font-black">{rawAttendance.length}</span> records
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:shadow-md transition-all disabled:opacity-30" disabled>
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1">
              <button className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200">1</button>
            </div>
            <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:shadow-md transition-all disabled:opacity-30" disabled>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* --- Authorized Punch-Out Modal --- */}
      <Modal open={punchOutModal.open} onClose={() => setPunchOutModal({ open: false, row: null })}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-amber-500 p-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <LogOut size={20} />
                  Authorized Early Exit
                </h3>
                <p className="text-amber-100 text-sm mt-1">Force punch-out for {punchOutModal.row?.name}</p>
              </div>
              <button
                onClick={() => setPunchOutModal({ open: false, row: null })}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="flex bg-amber-50 rounded-2xl p-4 gap-4 items-center">
                <AlertTriangle size={24} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                  This action forces the employee to punch out immediately. This should only be used for approved early departures or system issues.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Reason</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                  value={punchOutForm.reason}
                  onChange={(e) => setPunchOutForm({ ...punchOutForm, reason: e.target.value })}
                >
                  <option value="">Select a reason...</option>
                  {FORCE_PUNCH_OUT_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Note / Details</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none h-24"
                  placeholder="Provide brief details..."
                  value={punchOutForm.note}
                  onChange={(e) => setPunchOutForm({ ...punchOutForm, note: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setPunchOutForm({ ...punchOutForm, markFullDay: !punchOutForm.markFullDay })}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${punchOutForm.markFullDay ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white'}`}>
                  {punchOutForm.markFullDay && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Mark as 8-hours completed (Full Day)</div>
                  <div className="text-xs font-medium text-slate-500">Employee will be paid for a full day despite leaving early.</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
                onClick={() => setPunchOutModal({ open: false, row: null })}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 disabled:opacity-50"
                onClick={handleSubmitEarlyPunchOut}
                disabled={earlyPunchOutMutation.isPending}
              >
                {earlyPunchOutMutation.isPending ? 'Processing...' : 'Confirm Exit'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* --- Override Detail Modal --- */}
      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false, row: null })}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-slate-900 p-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Shield size={20} className={detailModal.row?.approved_full_day ? "text-emerald-400" : "text-amber-400"} />
                  Early Exit Details
                </h3>
                <p className="text-slate-400 text-sm mt-1">{detailModal.row?.name}</p>
              </div>
              <button
                onClick={() => setDetailModal({ open: false, row: null })}
                className="text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Actual Worked</p>
                  <p className="text-xl font-black text-slate-900">{detailModal.row?.actual_work_hours ?? '-'} <span className="text-sm font-bold text-slate-400">hrs</span></p>
                </div>
                <div className={`p-4 rounded-2xl border ${detailModal.row?.approved_full_day ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${detailModal.row?.approved_full_day ? 'text-emerald-600' : 'text-slate-400'}`}>Payable / Approved</p>
                  <p className={`text-xl font-black ${detailModal.row?.approved_full_day ? 'text-emerald-700' : 'text-slate-900'}`}>{detailModal.row?.approved_work_hours ?? '-'} <span className="text-sm font-bold opacity-50">hrs</span></p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Override Reason</p>
                <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <FileText size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{detailModal.row?.force_punch_out_reason}</p>
                    {detailModal.row?.force_punch_out_note && (
                      <p className="text-sm text-slate-600 mt-1">{detailModal.row.force_punch_out_note}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Action at: {detailModal.row?.force_punch_out_at ? new Date(detailModal.row.force_punch_out_at).toLocaleString() : '-'}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Early Exit Request Review Modal */}
      <Modal open={reviewEarlyExitModal.open} onClose={() => setReviewEarlyExitModal({ open: false, request: null })}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 500, bgcolor: 'background.paper', borderRadius: 4, boxShadow: 24, p: 0, overflow: 'hidden'
        }}>
          <div className="bg-orange-500 p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
              <LogOut size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Review Early Exit</h3>
              <p className="text-sm text-orange-100 font-medium">{reviewEarlyExitModal.request?.employee?.full_name}</p>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-4 bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="mb-2">
                <span className="text-[10px] uppercase font-bold text-orange-600 block mb-1">Reason</span>
                <span className="text-sm font-semibold text-slate-900">{reviewEarlyExitModal.request?.reason}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-orange-600 block mb-1">Employee Note</span>
                <span className="text-sm text-slate-700">{reviewEarlyExitModal.request?.note || 'No additional note'}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Reviewer Note (Required for Reject)</label>
              <textarea
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none h-20"
                placeholder="Add your note..."
                value={reviewEarlyExitForm.note}
                onChange={e => setReviewEarlyExitForm(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer mb-6 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                checked={reviewEarlyExitForm.markFullDay}
                onChange={e => setReviewEarlyExitForm(prev => ({ ...prev, markFullDay: e.target.checked }))}
              />
              <div>
                <span className="text-sm font-bold text-slate-800 block">Mark as Full Day</span>
                <span className="text-xs font-medium text-slate-500">Employee gets 8h credit (Approved leave early)</span>
              </div>
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                onClick={() => setReviewEarlyExitModal({ open: false, request: null })}
                disabled={reviewEarlyExitMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-200 flex items-center gap-2"
                onClick={() => handleReviewEarlyExit('rejected')}
                disabled={reviewEarlyExitMutation.isPending}
              >
                <X size={16} /> Reject
              </button>
              <button
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200 flex items-center gap-2"
                onClick={() => handleReviewEarlyExit('approved')}
                disabled={reviewEarlyExitMutation.isPending}
              >
                <Check size={16} /> Approve Early Exit
              </button>
            </div>
          </div>
        </Box>
      </Modal>

    </div>
  );
};

export default Attendance;
