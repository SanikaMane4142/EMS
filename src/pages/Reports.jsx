import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Skeleton, Dialog, IconButton, Avatar, Chip,
  Tooltip, TextField, InputAdornment, MenuItem, Select, Typography
} from '@mui/material';
import {
  BarChart3, Download, FileText, Calendar, Filter, TrendingUp, Eye, X,
  User, Clock, Star, CheckCircle, Search, AlertCircle, Zap, Users,
  ChevronRight, Brain, Trophy, ArrowUpRight, Layout, Info
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { useReports, useReviewReport } from '../hooks/useReports';
import { useDepartments, useDepartmentStats } from '../hooks/useDepartments';
import { useTodayStats, useAttendanceTrends } from '../hooks/useAttendance';

const Reports = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Queries
  const { data: reports = [], isLoading: loadingReports } = useReports(filterDate);
  const { data: departmentStats = [], isLoading: loadingDeptStats } = useDepartmentStats();
  const { data: attendanceStats, isLoading: loadingAttendance } = useTodayStats();
  const { data: attendanceTrends = [], isLoading: loadingTrends } = useAttendanceTrends();
  const reviewMutation = useReviewReport();

  useEffect(() => {
    const channel = supabase
      .channel('hr_reports_realtime_redesign')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reports'] });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [queryClient]);

  // Derived Data
  const filteredReports = useMemo(() => {
    return reports.filter(rep => {
      const matchesSearch = (rep.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === 'all' || rep.profiles?.department_id === deptFilter;
      const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [reports, searchQuery, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalEmployees = departmentStats.reduce((acc, curr) => acc + (curr.total || 0), 0) || 1;
    const avgProductivity = reports.length > 0
      ? (reports.reduce((acc, r) => acc + (r.productivity_rating || 0), 0) / reports.length).toFixed(1)
      : 0;
    const pendingCount = reports.filter(r => r.status === 'pending').length;
    const attendanceRate = attendanceStats ? Math.round((attendanceStats.present / totalEmployees) * 100) : 0;

    // Find top performer
    const topPerformer = reports.length > 0
      ? [...reports].sort((a, b) => (b.productivity_rating || 0) - (a.productivity_rating || 0))[0]
      : null;

    // AI Insights mock logic
    const insights = [];
    const blockers = reports.filter(r => (r.additional_notes || '').toLowerCase().includes('blocker') || (r.work_in_progress || '').toLowerCase().includes('blocker')).length;
    if (blockers > 0) insights.push({ text: `${blockers} employees reported blockers today`, icon: AlertCircle, color: '#ef4444' });
    if (attendanceRate < 80) insights.push({ text: `Attendance dropped to ${attendanceRate}% this week`, icon: TrendingUp, color: '#f59e0b' });
    if (avgProductivity > 8) insights.push({ text: `Productivity is exceptionally high today`, icon: Zap, color: '#10b981' });
    if (insights.length === 0) insights.push({ text: `Operations running smoothly across all departments`, icon: CheckCircle, color: '#4f46e5' });

    return { totalEmployees, avgProductivity, pendingCount, attendanceRate, topPerformer, insights };
  }, [reports, departmentStats, attendanceStats]);

  const handleReview = async (rep) => {
    try {
      await reviewMutation.mutateAsync({ id: rep.id, userId: rep.user_id, reviewerId: user.id });
      toast.success('Report marked as reviewed');
    } catch (err) {
      toast.error('Review failed: ' + err.message);
    }
  };

  const handleDownload = (rep) => {
    const content = `
DAILY WORK REPORT
-----------------
Employee: ${rep.profiles?.full_name || 'N/A'}
Date: ${new Date(rep.report_date).toLocaleDateString()}

1. TASKS PLANNED:
${rep.tasks_planned || 'N/A'}

2. TASKS COMPLETED:
${rep.tasks_completed || 'N/A'}

3. WORK IN PROGRESS:
${rep.work_in_progress || 'N/A'}

4. TOMORROW PLAN:
${rep.tomorrow_plan || 'N/A'}

5. METRICS:
Hours: ${rep.total_working_hours}
Rating: ${rep.productivity_rating}/10

-----------------
Generated by EMS
    `.trim();

    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Report_${rep.profiles?.full_name?.replace(/\s+/g, '_')}_${rep.report_date}.txt`;
    element.click();
    toast.success('Report downloaded successfully');
  };

  const handleExportAll = () => {
    if (filteredReports.length === 0) {
      toast.error('No reports to export matching current filters.');
      return;
    }
    const headers = ["Employee", "Department", "Date", "Tasks Planned", "Tasks Completed", "WIP", "Tomorrow Plan", "Hours", "Rating", "Status"];
    const rows = filteredReports.map(rep => [
      `"${rep.profiles?.full_name || 'Unknown'}"`,
      `"${rep.profiles?.departments?.name || 'N/A'}"`,
      `"${new Date(rep.report_date).toLocaleDateString()}"`,
      `"${(rep.tasks_planned || '').replace(/"/g, '""')}"`,
      `"${(rep.tasks_completed || '').replace(/"/g, '""')}"`,
      `"${(rep.work_in_progress || '').replace(/"/g, '""')}"`,
      `"${(rep.tomorrow_plan || '').replace(/"/g, '""')}"`,
      rep.total_working_hours || 0,
      rep.productivity_rating || 0,
      rep.status || 'pending'
    ]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reports_Export_${filterDate || 'Filtered'}.csv`;
    link.click();
  };

  const columns = [
    {
      field: 'employee',
      headerName: 'Employee',
      flex: 32,
      minWidth: 280,
      disableColumnMenu: true,
      renderCell: (params) => (
        <div className="flex items-center h-full" style={{ gap: '12px' }}>
          <Avatar sx={{ 
            width: 40, height: 40, 
            bgcolor: 'var(--primary-light)', 
            color: 'var(--primary)', 
            fontSize: 15, fontWeight: 700,
            border: '1px solid #e2e8f0'
          }}>
            {(params.row.profiles?.full_name || 'U').charAt(0)}
          </Avatar>
          <div className="flex flex-col justify-center overflow-hidden" style={{ gap: '4px' }}>
            <span className="text-[14px] font-bold text-slate-900 truncate leading-none">{params.row.profiles?.full_name}</span>
            <span className="text-[11px] text-slate-400 font-medium truncate leading-none uppercase tracking-wide">{params.row.profiles?.departments?.name || 'General'}</span>
          </div>
        </div>
      )
    },
    {
      field: 'productivity_rating',
      headerName: 'Productivity',
      flex: 18,
      minWidth: 160,
      disableColumnMenu: true,
      renderCell: (params) => (
        <div className="flex items-center h-full" style={{ gap: '12px' }}>
          <div className="bg-slate-100 rounded-full overflow-hidden" style={{ width: 90, height: 6 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(params.value || 0) * 10}%` }}
              className="h-full bg-indigo-500 rounded-full"
            />
          </div>
          <span className="text-[13px] font-bold text-slate-700">{params.value}/10</span>
        </div>
      )
    },
    {
      field: 'report_date',
      headerName: 'Submission',
      flex: 18,
      minWidth: 160,
      disableColumnMenu: true,
      renderCell: (params) => (
        <div className="flex flex-col justify-center h-full" style={{ gap: '4px' }}>
          <span className="text-[14px] font-bold text-slate-900 leading-[1.5]">{new Date(params.row.report_date).toLocaleDateString()}</span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider leading-[1.5]">{new Date(params.row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </div>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 16,
      minWidth: 160,
      disableColumnMenu: true,
      renderCell: (params) => {
        const status = params.value || 'pending';
        const config = {
          pending: { label: 'Pending', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
          reviewed: { label: 'Reviewed', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle },
          blocked: { label: 'Blocked', color: 'bg-red-50 text-red-600 border-red-100', icon: AlertCircle }
        };
        const s = config[status] || config.pending;
        const Icon = s.icon;
        return (
          <div className="flex items-center h-full">
            <div 
              className={`flex items-center rounded-full text-[11px] font-bold uppercase tracking-wider border ${s.color}`}
              style={{ height: 36, padding: '0 14px', gap: '6px' }}
            >
              <Icon size={14} />
              {s.label}
            </div>
          </div>
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 16,
      minWidth: 160,
      sortable: false,
      disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const rep = params.row;
        return (
          <div className="flex items-center justify-end h-full w-full" style={{ gap: '12px' }}>
            <Tooltip title="View Details">
              <button
                className="flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
                style={{ width: 38, height: 38 }}
                onClick={() => setSelectedReport(rep)}
              >
                <Eye size={18} />
              </button>
            </Tooltip>
            <Tooltip title="Download Report">
              <button
                className="flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                style={{ width: 38, height: 38 }}
                onClick={() => handleDownload(rep)}
              >
                <Download size={18} />
              </button>
            </Tooltip>
          </div>
        );
      }
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      <PageHeader title="Analytics & Reports" subtitle="Enterprise Human Resource Intelligence Dashboard" />

      {/* Top Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Reviews', value: stats.pendingCount, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Submitted Today', value: reports.length, icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((item, i) => (
          <motion.div
            key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="card-ems-static p-4 flex items-center gap-4 border-none shadow-sm hover:shadow-md transition-all cursor-default"
          >
            <div className={`p-3 rounded-2xl ${item.bg} ${item.color}`}>
              <item.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              <h3 className="text-xl font-black text-slate-900">{item.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter & Table Section */}
      <Box 
        className="card-ems-static border border-slate-100 overflow-hidden" 
        sx={{ 
          p: 0, 
          borderRadius: '20px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          mt: 2 
        }}
      >
        {/* Top Header Row with Filters Integrated */}
        <div className="px-8 py-6 bg-white border-b border-slate-50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[32px] font-black text-slate-900 tracking-tight">Daily Submission Log</h3>
            <button 
              className="flex items-center gap-2 px-5 bg-white border border-slate-200 rounded-xl text-indigo-600 text-[13px] font-bold hover:bg-indigo-50 transition-all shadow-sm" 
              style={{ height: 44, borderRadius: '12px' }}
              onClick={handleExportAll}
            >
              <Download size={18} /> Export All
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <TextField
              placeholder="Search employee..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ 
                width: 260,
                '& .MuiOutlinedInput-root': { 
                  height: 44,
                  borderRadius: '12px',
                  bgcolor: '#ffffff',
                  border: '1px solid #f1f5f9',
                  fontSize: '14px',
                  fontWeight: 500,
                  '& fieldset': { border: 'none' },
                  '&:hover fieldset': { border: 'none' },
                  '&.Mui-focused fieldset': { border: 'none' },
                }
              }}
              InputProps={{ 
                startAdornment: <InputAdornment position="start"><Search size={20} className="text-slate-400 mr-1" /></InputAdornment> 
              }}
            />

            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              size="small"
              displayEmpty
              sx={{ 
                width: 200, height: 44, borderRadius: '12px', bgcolor: '#ffffff', border: '1px solid #f1f5f9', fontSize: '14px', fontWeight: 500,
                '& fieldset': { border: 'none' } 
              }}
            >
              <MenuItem value="all">All Departments</MenuItem>
              {departmentStats.map(d => <MenuItem key={d.id || d.name} value={d.id || d.name}>{d.name}</MenuItem>)}
            </Select>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="small"
              displayEmpty
              sx={{ 
                width: 200, height: 44, borderRadius: '12px', bgcolor: '#ffffff', border: '1px solid #f1f5f9', fontSize: '14px', fontWeight: 500,
                '& fieldset': { border: 'none' } 
              }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="reviewed">Reviewed</MenuItem>
            </Select>

            <input
              type="date"
              className="form-input-ems"
              style={{ width: 180, height: 44, borderRadius: '12px', fontSize: '14px', fontWeight: 500, border: '1px solid #f1f5f9', backgroundColor: '#ffffff', padding: '0 16px' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />

            <button 
              className="w-[160px] h-[44px] rounded-xl bg-indigo-50 text-indigo-600 text-[13px] font-bold hover:bg-indigo-100 transition-all border border-indigo-100/50"
              style={{ borderRadius: '12px' }}
              onClick={() => { setSearchQuery(''); setDeptFilter('all'); setStatusFilter('all'); setFilterDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="bg-white" style={{ borderRadius: '0 0 16px 16px' }}>
          <DataTable
            columns={columns}
            data={filteredReports}
            loading={loadingReports}
            rowHeight={76}
            emptyMessage={
              <div className="py-24 flex flex-col items-center">
                <div className="p-6 bg-slate-50 rounded-full text-slate-200 mb-4"><Layout size={56} /></div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching reports found</p>
              </div>
            }
          />
        </div>
      </Box>

      {/* Report Detail Modal - High Resilience Version */}
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
              bgcolor: '#f8fafc', // slate-50
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
                  {selectedReport.profiles?.full_name?.charAt(0)}
                </Avatar>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', lineHeight: 1, mb: 0.5 }}>
                  {selectedReport.profiles?.full_name}
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
                  <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#eef2ff', display: 'flex', alignItems: 'center', justifyCenter: 'center', position: 'relative' }}>
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

              {/* Bottom Decoration */}
              <Box sx={{ mt: 'auto', pt: 5, opacity: 0.2, transform: 'rotate(-12deg) translateY(40px)' }}>
                <Layout size={100} strokeWidth={1} color="#6366f1" />
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4, flexShrink: 0 }}>
                {selectedReport.status === 'reviewed' ? (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    color: '#059669', bgcolor: '#ecfdf5',
                    px: 2, py: 1, borderRadius: '100px',
                    border: '1px solid #d1fae5', fontSize: '0.75rem', fontWeight: 700
                  }}>
                    <CheckCircle size={14} /> Review Completed
                  </Box>
                ) : (
                  <button
                    style={{
                      backgroundColor: '#4f46e5', color: '#ffffff',
                      padding: '10px 24px', borderRadius: '100px',
                      fontSize: '0.75rem', fontWeight: 700, border: 'none',
                      cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)'
                    }}
                    onClick={() => handleReview(selectedReport)}
                  >
                    Approve & Mark as Reviewed
                  </button>
                )}
              </Box>

              {/* Scrollable Content Area */}
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 1,
                overflowY: 'auto',
                pr: 2,
                mr: -2, // Offset padding for scrollbar
                '&::-webkit-scrollbar': { width: '5px' },
                '&::-webkit-scrollbar-track': { background: '#f8fafc' },
                '&::-webkit-scrollbar-thumb': { background: '#e2e8f0', borderRadius: '10px' },
                '&::-webkit-scrollbar-thumb:hover': { background: '#cbd5e1' }
              }}>
                {[
                  { label: 'Tasks Planned Today', value: selectedReport.tasks_planned, icon: Calendar, color: '#3b82f6' },
                  { label: 'Tasks Completed', value: selectedReport.tasks_completed, icon: CheckCircle, color: '#10b981' },
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

export default Reports;
