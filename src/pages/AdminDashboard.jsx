import React, { useState, useEffect } from 'react';
import { Box, Skeleton, Modal, TextField, Typography, Button, MenuItem } from '@mui/material';
import { Users, UserCheck, CalendarOff, Building, Shield, DollarSign, BarChart3, Activity, CheckSquare, Megaphone, Send, X, FileText, Clock, ChevronRight, Save, Zap, Archive, Trash2, History } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import CountdownBanner from '../components/CountdownBanner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { reportService } from '../services/reportService';
import { leaveService } from '../services/leaveService';
import { communicationService } from '../services/communicationService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabaseClient';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalEmployees: 0, activeEmployees: 0, totalReports: 0, pendingLeaves: 0 });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  // Announcement Modal State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeData, setNoticeData] = useState({ title: '', content: '', priority: 'info' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [empStats, deptList, reportCount, leaveStats] = await Promise.all([
          employeeService.getAdminStats(),
          departmentService.getAll(),
          reportService.getReportStats(),
          leaveService.getLeaveSummary()
        ]);

        setStats({
          ...empStats,
          totalReports: reportCount,
          pendingLeaves: leaveStats.pending
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    fetchAnnouncements();

    // Realtime subscription for announcements
    const channel = supabase
      .channel('admin_announcements')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements'
      }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setHistoryLoading(true);
      const data = await communicationService.getAllAnnouncements();
      console.log('Fetched Announcements:', data);
      setAnnouncements([...data]); // Force new array reference to trigger re-render
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleNotice = async (id, currentStatus) => {
    try {
      await communicationService.toggleStatus(id, !currentStatus);
      fetchAnnouncements();
      toast.success(currentStatus ? 'Notice Archived' : 'Notice Reactivated');
    } catch (err) {
      toast.error('Action failed: ' + err.message);
    }
  };

  const handleDeleteNotice = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will remove the notice from both Admin and Employee views. (Record will stay in database)",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, hide it!'
    });

    if (result.isConfirmed) {
      try {
        await communicationService.deleteNotice(id);
        fetchAnnouncements();
        toast.success('The notice has been removed.');
      } catch (err) {
        toast.error('Failed to hide notice: ' + err.message);
      }
    }
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!noticeData.title || !noticeData.content) return;

    try {
      setSubmitting(true);

      if (!user?.id) {
        throw new Error("User session not found. Please log in again.");
      }

      await communicationService.postAnnouncement({
        ...noticeData,
        userId: user.id
      });

      // Clear and close immediately on success
      setNoticeData({ title: '', content: '', priority: 'info' });
      setShowNoticeModal(false);
      fetchAnnouncements();

      Swal.fire({
        icon: 'success',
        title: 'Notice Broadcasted!',
        text: 'All employees will see this on their dashboard.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Error', 'Failed to post notice: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="System Administration" subtitle="Full system control panel — SUPER_ADMIN access">
        <button className="btn-ems btn-ems-outline" onClick={() => setShowNoticeModal(true)}>
          <Megaphone size={16} /> Broadcast Notice
        </button>
        <button className="btn-ems btn-ems-outline" onClick={() => navigate('/reports')}>
          <BarChart3 size={16} /> Reports
        </button>
        <button className="btn-ems btn-ems-primary" onClick={() => navigate('/users')}>
          <Shield size={16} /> Manage Users
        </button>
      </PageHeader>

      {/* Countdown Hero Banner Section */}
      <CountdownBanner />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <StatCard
          title="Total Employees"
          value={loading ? '...' : stats.totalEmployees.toString()}
          icon={Users} color="#4f46e5" bgColor="#eef2ff"
          onClick={() => navigate('/employees')}
        />
        <StatCard
          title="Active Employees"
          value={loading ? '...' : stats.activeEmployees.toString()}
          icon={UserCheck} color="#10b981" bgColor="#ecfdf5"
          onClick={() => navigate('/employees')}
        />
        <StatCard
          title="Pending Leaves"
          value={loading ? '...' : stats.pendingLeaves.toString()}
          icon={CalendarOff} color="#ef4444" bgColor="#fef2f2"
          onClick={() => navigate('/leave')}
        />
      </div>


      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6">

        {/* Quick Access Modules */}
        <Box className="card-ems p-6 relative overflow-hidden bg-white shadow-sm border border-slate-100 mb-6" style={{ borderRadius: '24px' }}>
          <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Zap size={18} className="text-indigo-500" /> Command Operations Center
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: 'Employees', icon: Users, color: '#4f46e5', bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', path: '/employees' },
              { label: 'Attendance', icon: UserCheck, color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', path: '/attendance' },
              { label: 'Leaves', icon: CalendarOff, color: '#ef4444', bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', path: '/leave' },
              { label: 'Reports', icon: Activity, color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', path: '/reports' },
              { label: 'Org Tasks', icon: CheckSquare, color: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', path: '/organization-tasks' },
              { label: 'Departments', icon: Building, color: '#7c3aed', bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', path: '/departments' },
            ].map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.div
                  key={i}
                  onClick={() => navigate(mod.path)}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer transition-all border border-slate-100 shadow-sm"
                  style={{ background: mod.bg }}
                  whileHover={{ y: -5, scale: 1.02, boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(mod.path); }}
                >
                  <div className="p-3 rounded-xl bg-white/70 shadow-sm backdrop-blur-sm">
                    <Icon size={24} style={{ color: mod.color }} />
                  </div>
                  <span className="text-sm font-black tracking-tight" style={{ color: mod.color }}>{mod.label}</span>
                </motion.div>
              );
            })}
          </div>
        </Box>

        {/* Broadcast History */}
        <div>
          <Box className="card-ems-static" sx={{ p: 0, overflow: 'hidden' }}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Broadcast History</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Manage organization-wide announcements</p>
                </div>
              </div>
              <button
                className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-all"
                onClick={fetchAnnouncements}
              >
                Refresh List
              </button>
            </div>

            <div className="table-responsive">
              <table className="table-ems">
                <thead>
                  <tr>
                    <th>Notice Title</th>
                    <th>Priority</th>
                    <th>Posted By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
                          <span className="text-xs text-slate-400 font-medium">Loading history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : announcements.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400">
                        <Megaphone size={32} className="mx-auto mb-2 opacity-20" />
                        No broadcast history found
                      </td>
                    </tr>
                  ) : announcements.map((notice) => (
                    <tr key={notice.id} className={!notice.is_active ? 'opacity-60 bg-slate-50/50' : ''}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{notice.title}</span>
                          <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {notice.content.replace(/<[^>]*>/g, '')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${notice.priority === 'urgent' ? 'bg-rose-50 text-rose-600' :
                          notice.priority === 'important' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                          {notice.priority}
                        </span>
                      </td>
                      <td className="text-sm font-medium text-slate-600">
                        {notice.author?.full_name || 'System'}
                      </td>
                      <td className="text-[11px] font-bold text-slate-400">
                        {new Date(notice.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span className={`status-dot ${notice.is_active ? 'online' : 'offline'}`}>
                          {notice.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleNotice(notice.id, notice.is_active)}
                            className={`p-2 rounded-lg transition-all ${notice.is_active
                              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                            title={notice.is_active ? 'Archive Notice' : 'Reactivate Notice'}
                          >
                            {notice.is_active ? <Archive size={16} /> : <Zap size={16} />}
                          </button>
                          <button
                            onClick={() => handleDeleteNotice(notice.id)}
                            className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                            title="Delete (Hide from Admin)"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
        </div>

      </div>

      {/* Broadcast Notice Modal - ENTERPRISE SPEC REDESIGN */}
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
          width: '100%',
          maxWidth: 860,
          bgcolor: '#f8fafc',
          borderRadius: '32px',
          boxShadow: '0 30px 100px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.8)',
          position: 'relative'
        }}>
          {/* Background Decorative Pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }}></div>

          <form onSubmit={handlePostNotice}>
            <div className="p-8">
              {/* Header Section */}
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 flex items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 ring-8 ring-indigo-50">
                    <Megaphone size={30} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Broadcast Organization Notice</h2>
                    <p className="text-slate-500 font-medium mt-2">Share important updates and announcements with all employees</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowNoticeModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100 shadow-sm">
                  <X size={20} />
                </button>
              </div>

              {/* Input Cards Row */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-widest mb-4 group-hover:text-indigo-600 transition-colors">
                    <CheckSquare size={14} className="text-indigo-500" /> Notice Title
                  </label>
                  <input
                    type="text" className="w-full text-base font-bold text-slate-900 placeholder-slate-300 bg-transparent border-none focus:ring-0 p-0"
                    placeholder="Enter a catchy title..."
                    value={noticeData.title} onChange={(e) => setNoticeData({ ...noticeData, title: e.target.value })} required
                  />
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:border-purple-200 transition-all group">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-widest mb-4 group-hover:text-purple-600 transition-colors">
                    <Shield size={14} className="text-purple-500" /> Priority Level
                  </label>
                  <select
                    className="w-full text-base font-bold text-slate-900 bg-transparent border-none focus:ring-0 p-0 cursor-pointer appearance-none"
                    value={noticeData.priority} onChange={(e) => setNoticeData({ ...noticeData, priority: e.target.value })}
                  >
                    <option value="info">General Information</option>
                    <option value="important">Important Update</option>
                    <option value="urgent">Urgent Notice</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Select the importance level of this notice</p>
                </div>
              </div>

              {/* Editor Section */}
              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-50/50 border-b border-slate-50 flex gap-2">
                  {['B', 'I', 'U'].map(btn => (
                    <button key={btn} type="button" className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-sm font-black text-slate-600 hover:bg-slate-100 transition-all">
                      {btn}
                    </button>
                  ))}
                </div>
                <div
                  contentEditable className="min-h-[220px] p-6 text-slate-600 text-base font-medium focus:outline-none leading-relaxed"
                  onInput={(e) => setNoticeData({ ...noticeData, content: e.currentTarget.innerHTML })}
                  dangerouslySetInnerHTML={{ __html: noticeData.content }}
                  data-placeholder="Write a clear and engaging announcement for your organization..."
                />
                <div className="p-4 bg-slate-50/30 border-t border-slate-50 flex items-center gap-2">
                  <Users size={14} className="text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">All active employees will receive this notice</span>
                </div>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="p-8 pt-2">
              <button
                type="submit"
                className="w-full h-16 flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[20px] font-black text-lg shadow-xl shadow-indigo-100 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                disabled={submitting}
              >
                <Send size={20} strokeWidth={2.5} /> {submitting ? 'Broadcasting...' : 'Broadcast to Organization'}
              </button>
            </div>
          </form>
        </Box>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
