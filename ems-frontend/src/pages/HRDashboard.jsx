import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Avatar, Skeleton } from '@mui/material';
import { Users, UserCheck, UserX, Clock, AlertCircle, CalendarOff, UserPlus, FileText } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { leaveService } from '../services/leaveService';
import { profileService } from '../services/profileService';
import { attendanceService } from '../services/attendanceService';
import { departmentService } from '../services/departmentService';
import { reportService } from '../services/reportService';

const HRDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [leaveStats, setLeaveStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [kpiStats, setKpiStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
  const [depts, setDepts] = useState([]);
  const [recentJoiners, setRecentJoiners] = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [attendanceData, leaves, todayKpi, departmentStats, joiners, reports, allEmps] = await Promise.allSettled([
        attendanceService.getAttendanceOverview(),
        leaveService.getLeaveSummary(),
        attendanceService.getTodayStats(),
        departmentService.getDepartmentStats(),
        profileService.getRecentJoiners(),
        reportService.getTodayReports(),
        profileService.getAllEmployees()
      ]);
      
      setAttendance(attendanceData.status === 'fulfilled' ? (attendanceData.value || []) : []);
      setLeaveStats(leaves.status === 'fulfilled' ? (leaves.value || { pending: 0, approved: 0, rejected: 0 }) : { pending: 0, approved: 0, rejected: 0 });
      setDepts(departmentStats.status === 'fulfilled' ? (departmentStats.value || []) : []);
      setRecentJoiners(joiners.status === 'fulfilled' ? (joiners.value || []) : []);
      setRecentReports(reports.status === 'fulfilled' ? (reports.value || []) : []);

      const totalEmps = allEmps.status === 'fulfilled' ? (allEmps.value?.length || 0) : 0;
      const presentCount = todayKpi.status === 'fulfilled' ? (todayKpi.value?.present || 0) : 0;

      setKpiStats({
        total: totalEmps,
        present: presentCount,
        absent: Math.max(0, totalEmps - presentCount),
        late: 0
      });

      const results = [attendanceData, leaves, todayKpi, departmentStats, joiners, reports];
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

    // Real-time: auto-refresh when attendance OR reports change
    const channel = supabase
      .channel('hr_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="HR Dashboard" subtitle="Overview of today's workforce activity" />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard title="Total Employees" value={loading ? '...' : kpiStats.total.toString()} icon={Users} color="#4f46e5" bgColor="#eef2ff" trend="up" trendValue="+3" />
        <StatCard title="Present Today" value={loading ? '...' : kpiStats.present.toString()} icon={UserCheck} color="#10b981" bgColor="#ecfdf5" />
        <StatCard title="Absent Today" value={loading ? '...' : kpiStats.absent.toString()} icon={UserX} color="#ef4444" bgColor="#fef2f2" />
        <StatCard title="Late Arrivals" value={loading ? '...' : kpiStats.late.toString()} icon={Clock} color="#f59e0b" bgColor="#fffbeb" />
      </div>

      {/* Alert Banner */}
      <div className="alert-ems danger mb-6">
        <AlertCircle size={16} />
        <span className="flex-1"><strong>Real-time Monitoring Active:</strong> Dashboard reflects live database state.</span>
        <button className="btn-ems btn-ems-secondary" style={{ height: 32, padding: '0 12px', fontSize: 12 }}>
          Configure Alerts
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Attendance Table (2/3) */}
        <div className="lg:col-span-2">
          <Box className="card-ems-static" sx={{ overflow: 'hidden', height: '100%' }}>
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
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && attendance.length === 0 ? (
                    <tr><td colSpan="5" className="text-center p-4">Loading today's attendance...</td></tr>
                  ) : attendance.length === 0 ? (
                    <tr><td colSpan="5" className="text-center p-4 text-slate-400">No punch-ins recorded for today yet</td></tr>
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

        {/* Department Load (1/3) */}
        <div>
          <Box className="card-ems-static" sx={{ p: 3, height: '100%' }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Department Load</h3>
            <div className="flex flex-col gap-5">
              {loading ? (
                [1,2,3,4].map(i => <Skeleton key={i} variant="text" height={40} />)
              ) : depts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No departments found</p>
              ) : depts.map((dept, i) => {
                const pct = dept.total > 0 ? Math.round((dept.present / dept.total) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{dept.icon}</span>
                        <span className="text-sm font-semibold">{dept.name}</span>
                      </div>
                      <span className="text-xs font-bold text-indigo-600">{pct}%</span>
                    </div>
                    <div className="progress-ems">
                      <div className="progress-ems-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-slate-400 font-medium">
                      <span>{dept.present} Present</span>
                      <span>{dept.total} Total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Box>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Joiners */}
        <Box className="card-ems-static" sx={{ p: 3 }}>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4"><UserPlus size={18} /> Recent Joiners</h3>
          <div className="flex flex-col gap-3">
            {loading ? (
              [1,2,3].map(i => <Skeleton key={i} variant="rounded" height={60} />)
            ) : recentJoiners.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No recent joiners</p>
            ) : recentJoiners.map((person, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-all">
                <Avatar sx={{ width: 40, height: 40, bgcolor: '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: 13 }}>{person.full_name?.charAt(0)}</Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{person.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{person.departments?.name || 'Operations'}</p>
                </div>
                <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{new Date(person.joined_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </Box>

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
    </div>
  );
};

export default HRDashboard;
