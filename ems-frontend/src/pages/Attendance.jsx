import React, { useState, useMemo } from 'react';
import { Box, Avatar, Chip, Tooltip, IconButton, Fade } from '@mui/material';
import {
  UserCheck, UserX, Clock, Download, Calendar, Search,
  Filter, MoreHorizontal, MapPin, Plane, ArrowUpRight,
  TrendingUp, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { utils, writeFile, write } from 'xlsx';
import PageHeader from '../components/PageHeader';
import { useAttendanceOverview } from '../hooks/useAttendance';
import { useDepartments } from '../hooks/useDepartments';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

// --- Styled Components / Constants ---
const STATUS_CONFIG = {
  'Present': { color: '#10b981', bg: '#ecfdf5', label: 'Present', icon: UserCheck },
  'Late': { color: '#f59e0b', bg: '#fffbeb', label: 'Late', icon: Clock },
  'Absent': { color: '#ef4444', bg: '#fef2f2', label: 'Absent', icon: UserX },
  'On Leave': { color: '#8b5cf6', bg: '#f5f3ff', label: 'On Leave', icon: Plane },
  'Remote': { color: '#3b82f6', bg: '#eff6ff', label: 'Remote', icon: MapPin },
};

const Attendance = () => {
  const { profile } = useAuth();

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

  // Process data to add "Late" and "Remote" (simulated for UI)
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

      // Simulate "Remote" for certain depts (just for design demo)
      if (item.dept === 'Engineering' && Math.random() > 0.8) {
        status = 'Remote';
      }

      return { ...item, displayStatus: status };
    }).filter(item => statusFilter === 'all' || item.displayStatus === statusFilter);
  }, [rawAttendance, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = rawAttendance.length;
    const present = rawAttendance.filter(a => a.status === 'Present' || a.status === 'Left').length;
    const late = attendance.filter(a => a.displayStatus === 'Late').length;
    const remote = attendance.filter(a => a.displayStatus === 'Remote').length;

    return {
      present,
      late,
      onLeave: 2, // Mocked for design parity
      remote,
      totalHours: rawAttendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0).toFixed(1)
    };
  }, [rawAttendance, attendance]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Present Employees', value: stats.present, icon: UserCheck, color: 'emerald', trend: '+12% from yesterday' },
          { label: 'Late Employees', value: stats.late, icon: Clock, color: 'amber', trend: '-2% from yesterday' },
          { label: 'On Leave', value: stats.onLeave, icon: Plane, color: 'indigo', trend: 'Stable' },
          { label: 'Working Remotely', value: stats.remote, icon: MapPin, color: 'blue', trend: '+5% this week' },
        ].map((kpi, i) => (
          <div key={i} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={24} />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp size={10} />
                {kpi.trend}
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mb-1">{loadingAttendance ? '...' : kpi.value}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-4 z-30 p-4 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 mb-8">
        <div className="flex flex-col lg:flex-row gap-6 items-center">

          {/* Search */}
          <div className="relative flex-1 w-full lg:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-700"
              value={empIdSearch}
              onChange={(e) => setEmpIdSearch(e.target.value)}
            />
          </div>

          {/* Vertical Divider */}
          <div className="hidden lg:block w-[1px] h-10 bg-slate-100" />

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            {/* Status Chips */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-2xl">
              {['all', 'Present', 'Late', 'Absent', 'On Leave'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${statusFilter === status
                      ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Dept Dropdown */}
            <select
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-tight text-slate-600 outline-none cursor-pointer"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>

            {/* Date Range */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-2xl border border-indigo-100">
              <input type="date" className="bg-transparent border-none text-[10px] font-black text-indigo-600 outline-none cursor-pointer" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <ArrowUpRight size={14} className="text-indigo-300" />
              <input type="date" className="bg-transparent border-none text-[10px] font-black text-indigo-600 outline-none cursor-pointer" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Employee Info</th>
                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Department</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Check In/Out</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Metrics</th>
                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Work Hours</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingAttendance ? (
                // Skeleton loading rows
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-8 py-10">
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
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar
                            sx={{
                              width: 52, height: 52,
                              borderRadius: '18px',
                              bgcolor: '#f8fafc',
                              border: '2px solid white',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                              fontSize: 16, fontWeight: 800, color: '#64748b'
                            }}
                          >
                            {row.name.charAt(0)}
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${row.punchIn !== '-' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{row.name}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">ID: {row.empId}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-medium text-slate-400 lowercase">{row.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-6 py-6">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/50 text-slate-600 rounded-xl border border-slate-200/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-tight">{row.dept}</span>
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td className="px-6 py-6">
                      <div className="flex justify-center">
                        <div
                          className="px-4 py-2 rounded-2xl flex items-center gap-2 border shadow-sm transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: STATUS_CONFIG[row.displayStatus]?.bg || '#f1f5f9',
                            borderColor: `${STATUS_CONFIG[row.displayStatus]?.color}15`,
                            color: STATUS_CONFIG[row.displayStatus]?.color || '#64748b'
                          }}
                        >
                          {(() => {
                            const Icon = STATUS_CONFIG[row.displayStatus]?.icon;
                            return Icon ? <Icon size={14} /> : null;
                          })()}
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {row.displayStatus}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Time Tracking */}
                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <div className="text-[10px] font-black text-slate-300 uppercase mb-1">In</div>
                          <div className="font-mono text-sm font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            {row.punchIn}
                          </div>
                        </div>
                        <div className="h-[2px] w-4 bg-slate-100 mt-4" />
                        <div className="text-center">
                          <div className="text-[10px] font-black text-slate-300 uppercase mb-1">Out</div>
                          <div className="font-mono text-sm font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            {row.punchOut}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Compact Metric Cards */}
                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <Tooltip title="Lunch Break">
                          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-100 min-w-[50px]">
                            <span className="text-[8px] font-black text-slate-400 uppercase">Lunch</span>
                            <span className="text-xs font-bold text-slate-700">{row.lunchDuration}m</span>
                          </div>
                        </Tooltip>
                        <Tooltip title="Overtime">
                          <div className={`flex flex-col items-center p-2 rounded-xl border min-w-[50px] ${row.overtime > 0 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-40'}`}>
                            <span className="text-[8px] font-black uppercase">OT</span>
                            <span className="text-xs font-bold">{row.overtime > 0 ? `${row.overtime}h` : '--'}</span>
                          </div>
                        </Tooltip>
                      </div>
                    </td>

                    {/* Work Hours Highlighting */}
                    <td className="px-6 py-6 text-right">
                      <div className="inline-flex flex-col items-end">
                        <div className="text-2xl font-black text-indigo-600 tabular-nums">
                          {row.totalHours > 0 ? row.totalHours : '0.0'}
                          <span className="text-xs font-bold ml-1 text-slate-400">hrs</span>
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total Logged</div>
                      </div>
                    </td>

                    {/* Row Action */}
                    <td className="px-8 py-6 text-right">
                      <IconButton size="small" className="text-slate-300 hover:text-slate-600 hover:bg-slate-100">
                        <MoreHorizontal size={18} />
                      </IconButton>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
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
