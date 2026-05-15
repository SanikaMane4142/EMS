import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Avatar, Skeleton, Modal } from '@mui/material';
import { toast } from 'react-hot-toast';
import { 
  Users, UserCheck, UserX, Clock, CalendarOff, FileText, 
  Megaphone, Send, X, ChevronRight, Save, Zap, Archive, Trash2, History,
  CheckSquare, Shield, Building
} from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { leaveService } from '../services/leaveService';
import { profileService } from '../services/profileService';
import { attendanceService } from '../services/attendanceService';
import { reportService } from '../services/reportService';
import { communicationService } from '../services/communicationService';
import Swal from 'sweetalert2';

const HRDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [leaveStats, setLeaveStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [kpiStats, setKpiStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
  const [activeNoticeCount, setActiveNoticeCount] = useState(0);

  // Announcement State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [noticeData, setNoticeData] = useState({ title: '', content: '', priority: 'info' });
  const [submitting, setSubmitting] = useState(false);


  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [attendanceData, leaves, todayKpi, reports, allEmps, activeNotices] = await Promise.allSettled([
        attendanceService.getAttendanceOverview(),
        leaveService.getLeaveSummary(),
        attendanceService.getTodayStats(),
        reportService.getTodayReports(),
        profileService.getAllEmployees(),
        supabase.from('announcements').select('*', { count: 'exact', head: true }).eq('is_active', true).neq('is_deleted', true)
      ]);
      
      setAttendance(attendanceData.status === 'fulfilled' ? (attendanceData.value || []) : []);
      setLeaveStats(leaves.status === 'fulfilled' ? (leaves.value || { pending: 0, approved: 0, rejected: 0 }) : { pending: 0, approved: 0, rejected: 0 });
      setRecentReports(reports.status === 'fulfilled' ? (reports.value || []) : []);
      setActiveNoticeCount(activeNotices.status === 'fulfilled' ? (activeNotices.value?.count || 0) : 0);

      const totalEmps = allEmps.status === 'fulfilled' ? (allEmps.value?.length || 0) : 0;
      const presentCount = todayKpi.status === 'fulfilled' ? (todayKpi.value?.present || 0) : 0;

      setKpiStats({
        total: totalEmps,
        present: presentCount,
        absent: Math.max(0, totalEmps - presentCount),
        late: 0
      });

      const results = [attendanceData, leaves, todayKpi, reports];
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[HR Dashboard] Service ${i} failed:`, r.reason?.message);
      });

    } catch (err) {
      console.error('HR Dashboard Data Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchAnnouncements();

    // Real-time: auto-refresh when attendance OR reports change
    const channel = supabase
      .channel('hr_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setHistoryLoading(true);
      const data = await communicationService.getAllAnnouncements();
      setAnnouncements([...data]);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!noticeData.title || !noticeData.content) return;

    try {
      setSubmitting(true);
      await communicationService.postAnnouncement({ ...noticeData, userId: user.id });
      setNoticeData({ title: '', content: '', priority: 'info' });
      setShowNoticeModal(false);
      toast.success('Broadcast Sent: Notice is now live.');
    } catch (err) {
      toast.error('Failed to post: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleNotice = async (id, currentStatus) => {
    try {
      await communicationService.toggleStatus(id, !currentStatus);
      toast.success(currentStatus ? 'Notice Archived' : 'Notice Reactivated');
    } catch (err) {
      toast.error('Action failed: ' + err.message);
    }
  };

  const handleDeleteNotice = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "Record will stay in database but hide from dashboards.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, hide it!'
    });

    if (result.isConfirmed) {
      try {
        await communicationService.deleteNotice(id);
      } catch (err) {
        Swal.fire('Error', 'Failed: ' + err.message, 'error');
      }
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="HR Dashboard" subtitle="Overview of today's workforce activity">
        <button className="btn-ems btn-ems-outline" onClick={() => setShowNoticeModal(true)}>
          <Megaphone size={16} /> Broadcast Notice
        </button>
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <StatCard title="Total Employees" value={loading ? '...' : kpiStats.total.toString()} icon={Users} color="#4f46e5" bgColor="#eef2ff" />
        <StatCard title="Present Today" value={loading ? '...' : kpiStats.present.toString()} icon={UserCheck} color="#10b981" bgColor="#ecfdf5" />
        <StatCard title="Absent Today" value={loading ? '...' : kpiStats.absent.toString()} icon={UserX} color="#ef4444" bgColor="#fef2f2" />
        <StatCard title="Leave Requests" value={loading ? '...' : leaveStats.pending.toString()} icon={CalendarOff} color="#f59e0b" bgColor="#fffbeb" />
        <StatCard title="Live Notices" value={loading ? '...' : activeNoticeCount.toString()} icon={Megaphone} color="#7c3aed" bgColor="#f5f3ff" />
      </div>

      {/* Quick Access Modules */}
      <Box className="card-ems-static" sx={{ p: 3, mb: 6 }}>
        <h3 className="text-base font-bold text-slate-900 mb-5">Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Employees', icon: Users, color: '#4f46e5', bg: '#eef2ff', path: '/employees' },
            { label: 'Attendance', icon: Clock, color: '#10b981', bg: '#ecfdf5', path: '/attendance' },
            { label: 'Leaves', icon: CalendarOff, color: '#ef4444', bg: '#fef2f2', path: '/leave' },
            { label: 'Org Tasks', icon: CheckSquare, color: '#f59e0b', bg: '#fffbeb', path: '/organization-tasks' },
            { label: 'Departments', icon: Building, color: '#7c3aed', bg: '#f5f3ff', path: '/departments' },
          ].map((mod, i) => {
            const Icon = mod.icon;
            return (
              <div
                key={i}
                onClick={() => navigate(mod.path)}
                className="flex flex-col items-center gap-3 p-5 rounded-xl cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md border border-transparent"
                style={{ background: mod.bg }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(mod.path); }}
              >
                <div className="p-3 rounded-xl" style={{ background: `${mod.color}20` }}>
                  <Icon size={22} style={{ color: mod.color }} />
                </div>
                <span className="text-sm font-bold" style={{ color: mod.color }}>{mod.label}</span>
              </div>
            );
          })}
        </div>
      </Box>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 3, pb: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <h3 className="text-base font-bold text-slate-900">Attendance Overview</h3>
            <div className="flex gap-2">
              <button className="btn-ems btn-ems-primary" style={{ height: 32, fontSize: 12, padding: '0 12px' }} onClick={() => navigate('/organization-tasks')}>
                 Manage Tasks
              </button>
              <button className="btn-ems btn-ems-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>Today</button>
            </div>
          </Box>
          <div className="table-responsive">
            <table className="table-ems">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th style={{ textAlign: 'center' }}>Punch In</th>
                  <th style={{ textAlign: 'center' }}>Punch Out</th>
                  <th style={{ textAlign: 'center' }}>Lunch</th>
                  <th style={{ textAlign: 'center' }}>Overtime</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && attendance.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-4">Loading today's attendance...</td></tr>
                ) : attendance.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-4 text-slate-400">No punch-ins recorded for today yet</td></tr>
                ) : attendance.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 12 }}>
                          {row.name?.charAt(0)}
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-slate-500">{row.dept}</td>
                    <td className="text-sm font-medium text-center">{row.punchIn}</td>
                    <td className="text-sm font-medium text-center">
                      {row.punchOut === '-' ? <span className="text-amber-500 font-semibold">Active</span> : row.punchOut}
                    </td>
                    <td className="text-sm font-medium text-center text-slate-500">
                      {row.lunchDuration > 0 ? `${row.lunchDuration}m` : '-'}
                    </td>
                    <td className="text-sm font-bold text-center text-indigo-600">
                      {row.overtime > 0 ? `${row.overtime}h` : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge-pill ${row.status === 'Present' ? 'success' : 'info'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Requests Summary */}
        <Box className="card-ems-static" sx={{ p: 3 }}>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4"><CalendarOff size={18} /> Leave Summary</h3>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Approved', count: leaveStats.approved, color: '#10b981', bg: '#ecfdf5' },
              { label: 'Pending', count: leaveStats.pending, color: '#f59e0b', bg: '#fffbeb' },
              { label: 'Rejected', count: leaveStats.rejected, color: '#ef4444', bg: '#fef2f2' },
            ].map((item, i) => (
              <div key={i} className="text-center p-3 rounded-xl" style={{ background: item.bg }}>
                <p className="text-2xl font-extrabold" style={{ color: item.color }}>{item.count}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase mt-1 tracking-tighter">{item.label}</p>
              </div>
            ))}
          </div>
          <button className="btn-ems btn-ems-outline w-full" style={{ height: 40 }} onClick={() => navigate('/leave')}>
            Manage All Requests
          </button>
        </Box>

        {/* Today's Work Reports */}
        <Box className="card-ems-static" sx={{ p: 3 }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><FileText size={18} /> Today's Reports</h3>
            <button className="text-xs font-bold text-indigo-600 hover:underline" onClick={() => navigate('/reports')}>View All</button>
          </div>
          <div className="flex flex-col gap-3">
            {loading ? (
              [1, 2].map(i => <Skeleton key={i} variant="rounded" height={60} />)
            ) : recentReports.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No reports submitted today yet.</p>
            ) : recentReports.slice(0, 4).map((rep, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all border border-slate-50">
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#f0f9ff', color: '#0ea5e9', fontWeight: 700, fontSize: 13 }}>{rep.profiles?.full_name?.charAt(0)}</Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{rep.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{rep.tasks_completed}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{rep.total_working_hours}h</span>
                </div>
              </div>
            ))}
          </div>
        </Box>
      </div>

      {/* Broadcast History */}
      <Box className="card-ems-static" sx={{ mt: 3, p: 0, overflow: 'hidden' }}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <History size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Broadcast History</h3>
              <p className="text-[11px] text-slate-500 font-medium">Your recent organization-wide announcements</p>
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table-ems">
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Posted By</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan="5" className="text-center py-6">Loading...</td></tr>
              ) : announcements.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-6 text-slate-400 italic">No history found</td></tr>
              ) : announcements.map(notice => (
                <tr key={notice.id} className={!notice.is_active ? 'opacity-60 bg-slate-50/50' : ''}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{notice.title}</span>
                      <span className="text-[11px] text-slate-500 truncate max-w-[250px]">{notice.content?.replace(/<[^>]*>/g, '')}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      notice.priority === 'urgent' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {notice.priority}
                    </span>
                  </td>
                  <td className="text-sm font-medium">{notice.author?.full_name || 'System'}</td>
                  <td className="text-[11px] font-bold text-slate-400">{new Date(notice.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleToggleNotice(notice.id, notice.is_active)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all" title="Archive/Restore">
                        {notice.is_active ? <Archive size={16} className="text-amber-600" /> : <Zap size={16} className="text-emerald-600" />}
                      </button>
                      <button onClick={() => handleDeleteNotice(notice.id)} className="p-1.5 hover:bg-rose-50 rounded-lg transition-all" title="Hide Permanently">
                        <Trash2 size={16} className="text-rose-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {/* Enterprise-Grade Broadcast Modal */}
      <Modal 
        open={showNoticeModal} 
        onClose={() => setShowNoticeModal(false)}
        container={() => document.getElementById('root')}
        slotProps={{
          backdrop: { 
            style: { 
              backgroundColor: 'rgba(15, 23, 42, 0.45)', 
              backdropFilter: 'blur(12px)' 
            }
          }
        }}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
      >
        <Box sx={{
          width: '100%', maxWidth: 820, 
          bgcolor: 'rgba(255, 255, 255, 0.92)', 
          backdropFilter: 'blur(20px)',
          borderRadius: '28px', 
          boxShadow: '0 20px 60px rgba(91, 33, 182, 0.18)', 
          overflow: 'hidden',
          outline: 'none', 
          border: '1px solid rgba(255, 255, 255, 0.4)',
          position: 'relative',
          '&::after': { // Ambient Glow
            content: '""', position: 'absolute', inset: 0, 
            boxShadow: '0 0 40px rgba(91, 33, 182, 0.1)', 
            pointerEvents: 'none', borderRadius: 'inherit'
          }
        }}>
          {/* Subtle Dotted Pattern in Top-Right */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(#5B21F6 1px, transparent 1px)', backgroundSize: '12px 12px' }} 
          />

          {/* Header Section */}
          <div className="p-8 pb-4 flex items-start gap-8">
            <div className="flex-shrink-0 relative">
              <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#7C3AED] to-[#5B21F6] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(91,33,182,0.3)]">
                <Megaphone size={32} />
              </div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-[32px] font-bold text-[#111827] leading-none">Broadcast Organization Notice</h2>
              <p className="text-[15px] text-[#6B7280] font-medium mt-1.5">Share important updates and announcements with all employees</p>
            </div>

            <button 
              onClick={() => setShowNoticeModal(false)} 
              className="w-11 h-11 rounded-full border border-[#DDD6FE] flex items-center justify-center text-[#5B21F6] hover:bg-[#F5F3FF] transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handlePostNotice} className="p-8 pt-4 space-y-6">
            
            <div className="grid grid-cols-2 gap-6">
              {/* Notice Title Card */}
              <div className="bg-white p-5 rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#374151] mb-3">
                  <CheckSquare size={16} className="text-[#5B21F6]" /> Notice Title
                </label>
                <input
                  type="text" placeholder="Enter a catchy title..."
                  className="w-full h-[54px] rounded-[14px] border-2 border-[#DDD6FE] px-4 text-[15px] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/15 transition-all placeholder:text-[#9CA3AF]"
                  value={noticeData.title} onChange={(e) => setNoticeData({...noticeData, title: e.target.value})}
                  required
                />
              </div>

              {/* Priority Level Card */}
              <div className="bg-white p-5 rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#374151] mb-3">
                  <Shield size={16} className="text-[#5B21F6]" /> Priority Level
                </label>
                <select
                  className="w-full h-[54px] rounded-[14px] border-2 border-[#DDD6FE] px-4 text-[15px] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/15 transition-all bg-white appearance-none cursor-pointer"
                  value={noticeData.priority} onChange={(e) => setNoticeData({...noticeData, priority: e.target.value})}
                >
                  <option value="info">General Information</option>
                  <option value="important">Important Update</option>
                  <option value="urgent">Urgent Notice</option>
                  <option value="emergency">Emergency Alert</option>
                </select>
                <p className="text-[13px] text-[#6B7280] mt-2 font-medium">Select the importance level of this notice</p>
              </div>
            </div>

            {/* Notice Content Card - Functional Rich Text Editor */}
            <div className="bg-white rounded-[20px] border border-[#E5E7EB] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              {/* Toolbar */}
              <div className="h-[54px] bg-[#F8FAFC] border-b border-[#F3F4F6] px-5 flex items-center gap-5 text-[#6B7280]">
                 <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => document.execCommand('bold', false)}
                      className="w-10 h-10 flex items-center justify-center font-bold text-[#111827] cursor-pointer hover:bg-[#F5F3FF] rounded-lg transition-colors border border-[#DDD6FE]"
                    >B</button>
                    <button 
                      type="button"
                      onClick={() => document.execCommand('italic', false)}
                      className="w-10 h-10 flex items-center justify-center italic font-serif text-[#111827] cursor-pointer hover:bg-[#F5F3FF] rounded-lg transition-colors border border-[#DDD6FE]"
                    >/</button>
                    <button 
                      type="button"
                      onClick={() => document.execCommand('underline', false)}
                      className="w-10 h-10 flex items-center justify-center underline text-[#111827] cursor-pointer hover:bg-[#F5F3FF] rounded-lg transition-colors border border-[#DDD6FE]"
                    >U</button>
                 </div>
              </div>

              {/* Editable Content Area */}
              <div
                contentEditable="true"
                className="w-full min-h-[220px] p-6 text-[16px] leading-[1.8] text-[#374151] outline-none empty:before:content-[attr(placeholder)] empty:before:text-[#9CA3AF]"
                placeholder="Write a clear and engaging announcement for your organization..."
                onInput={(e) => setNoticeData({...noticeData, content: e.currentTarget.innerHTML})}
                style={{ wordBreak: 'break-word' }}
              />

              <div className="p-4 px-6 bg-[#F8FAFC] border-t border-[#F3F4F6] flex justify-between items-center text-[13px] text-[#6B7280]">
                <span className="flex items-center gap-2 font-medium"><Users size={16} /> All active employees will receive this notice</span>
                <span className="flex items-center gap-2 font-medium"><Clock size={16} /> Drafts are saved automatically</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-5 pt-2">
              <button 
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="w-[220px] h-[58px] rounded-[18px] border-2 border-[#DDD6FE] text-[#5B21F6] font-bold text-[16px] hover:bg-[#F5F3FF] transition-all flex items-center justify-center"
              >
                Save Draft
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="flex-1 h-[58px] rounded-[18px] bg-gradient-to-r from-[#7C3AED] to-[#5B21F6] text-white font-bold text-[16px] shadow-[0_10px_30px_rgba(91,33,182,0.35)] hover:shadow-[0_12px_35px_rgba(91,33,182,0.45)] hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
              >
                {submitting ? 'Broadcasting...' : (
                  <>
                    <Send size={20} className="-rotate-12" />
                    Broadcast to Organization
                  </>
                )}
              </button>
            </div>
          </form>
        </Box>
      </Modal>
    </div>
  );
};

export default HRDashboard;
