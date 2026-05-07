import React, { useState, useEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import { Users, UserCheck, CalendarOff, Building, Shield, DollarSign, BarChart3, Activity, CheckSquare } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { reportService } from '../services/reportService';
import { leaveService } from '../services/leaveService';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalEmployees: 0, activeEmployees: 0, totalDepartments: 0, totalReports: 0, pendingLeaves: 0 });
  const [loading, setLoading] = useState(true);

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
          totalDepartments: deptList.length,
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
  }, []);

  const systemStats = [
    { label: 'DB Connections', value: 'Connected', color: '#10b981' },
    { label: 'Auth Service', value: 'Active', color: '#3b82f6' },
    { label: 'RLS Policies', value: 'Enabled', color: '#8b5cf6' },
    { label: 'Daily Reports', value: stats.totalReports.toString(), color: '#f59e0b' },
  ];


  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="System Administration" subtitle="Full system control panel — SUPER_ADMIN access">
        <button className="btn-ems btn-ems-outline" onClick={() => navigate('/reports')}>
          <BarChart3 size={16} /> Reports
        </button>
        <button className="btn-ems btn-ems-primary" onClick={() => navigate('/users')}>
          <Shield size={16} /> Manage Users
        </button>
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard 
          title="Total Employees" 
          value={loading ? '...' : stats.totalEmployees.toString()} 
          icon={Users} color="#4f46e5" bgColor="#eef2ff" 
          onClick={() => navigate('/employees')} 
        />
        <StatCard 
          title="Total Departments" 
          value={loading ? '...' : stats.totalDepartments.toString()} 
          icon={Building} color="#8b5cf6" bgColor="#f5f3ff" 
          onClick={() => navigate('/departments')} 
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Access Modules */}
        <div className="lg:col-span-2">
          <Box className="card-ems-static" sx={{ p: 3 }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Quick Access</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Employees', icon: Users, color: '#4f46e5', bg: '#eef2ff', path: '/employees' },
                { label: 'Departments', icon: Building, color: '#8b5cf6', bg: '#f5f3ff', path: '/departments' },
                { label: 'Attendance', icon: UserCheck, color: '#10b981', bg: '#ecfdf5', path: '/attendance' },
                { label: 'Leaves', icon: CalendarOff, color: '#ef4444', bg: '#fef2f2', path: '/leave' },
                { label: 'Reports', icon: Activity, color: '#3b82f6', bg: '#eff6ff', path: '/reports' },
                { label: 'Org Tasks', icon: CheckSquare, color: '#f59e0b', bg: '#fffbeb', path: '/organization-tasks' },
              ].map((mod, i) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={i}
                    onClick={() => navigate(mod.path)}
                    className="flex flex-col items-center gap-3 p-5 rounded-xl cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md"
                    style={{ background: mod.bg, border: '1px solid transparent' }}
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
        </div>

        {/* System Health */}
        <div>
          <Box className="card-ems-static" sx={{ p: 3, height: '100%' }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">System Health</h3>
            <div className="flex flex-col gap-4">
              {loading ? (
                [1,2,3,4].map(i => <Skeleton key={i} variant="rounded" height={45} />)
              ) : systemStats.map((stat, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                  <span className="text-sm font-semibold text-slate-600">{stat.label}</span>
                  <span className="text-sm font-extrabold" style={{ color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
              <p className="text-sm font-bold mb-1">Live Database Connection</p>
              <p className="text-xs opacity-70">Region: Supabase Cloud (AWS)</p>
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
