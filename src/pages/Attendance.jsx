import React, { useState, useMemo, useEffect } from 'react';
import { Box, Avatar } from '@mui/material';
import {
  UserCheck, UserX, Clock, Download, Calendar, Search,
  MapPin, Plane, ArrowUpRight, Check, X,
  TrendingUp, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { utils, writeFile, write } from 'xlsx';
import PageHeader from '../components/PageHeader';
import { useAttendanceOverview, usePendingAbsenceExplanations, useReviewAbsenceExplanation } from '../hooks/useAttendance';
import { useDepartments } from '../hooks/useDepartments';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

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
};

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
                  className={`px-4 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                    statusFilter === status
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
                {hasPendingActions && <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingAttendance ? (
                // Skeleton loading rows
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={hasPendingActions ? 8 : 7} className="px-8 py-10">
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
                      </div>
                    </td>

                    {/* Row Action */}
                    {hasPendingActions && (
                      <td className="px-8 py-5 text-center">
                        {(row.absenceExplanation?.status === 'pending' || pendingExplanationByAttendanceId[row.id]?.status === 'pending') ? (
                          <button
                            className="group/btn relative px-6 py-2.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all hover:shadow-lg hover:shadow-emerald-200 active:scale-95 disabled:opacity-50"
                            disabled={reviewExplanationMutation.isPending}
                            onClick={() => handleReviewReason((row.absenceExplanation?.id || pendingExplanationByAttendanceId[row.id]?.id), 'approved')}
                          >
                            <span className="flex items-center gap-2">
                              <Check size={14} strokeWidth={3} />
                              Review
                            </span>
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                             <Check size={14} />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={hasPendingActions ? 8 : 7} className="px-8 py-20 text-center">
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
    </div>
  );
};

export default Attendance;
