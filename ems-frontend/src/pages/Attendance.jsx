import React, { useState, useEffect } from 'react';
import { Box, Avatar, Skeleton } from '@mui/material';
import { UserCheck, UserX, Clock, Download, ChevronLeft, ChevronRight, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabaseClient';
import { departmentService } from '../services/departmentService';
import { attendanceService } from '../services/attendanceService';
import { profileService } from '../services/profileService';

const Attendance = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendance, setAttendance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');
  const [stats, setStats] = useState({ present: 0, total: 0 });

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const dateStr = currentDate.toLocaleDateString('en-CA');

      const [attRes, depts, employees] = await Promise.all([
        supabase.from('attendance').select('*').eq('attendance_date', dateStr),
        departmentService.getAll(),
        profileService.getAllEmployees()
      ]);

      if (attRes.error) throw attRes.error;

      const formatted = (attRes.data || []).map(item => {
        const profile = employees.find(e => e.id === item.user_id);
        return {
          id: item.id,
          name: profile?.full_name || 'Incomplete Profile',
          dept: profile?.departments?.name || 'Unassigned',
          in: item.punch_in_time ? new Date(item.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          out: item.punch_out_time ? new Date(item.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          hours: item.total_hours ? `${item.total_hours}h` : '-',
          status: item.status.replace('_', ' '),
          rawStatus: item.status
        };
      });

      setAttendance(formatted);
      setDepartments(depts);
      setStats({
        present: attRes.data?.length || 0,
        total: employees.length
      });
    } catch (err) {
      console.error('Attendance Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [currentDate]);

  const filtered = attendance.filter(a => deptFilter === 'all' || a.dept === deptFilter);

  const adjustDate = (days) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="Attendance" subtitle="Track employee attendance">
        <button className="btn-ems btn-ems-outline">
          <Download size={16} /> Export Log
        </button>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <StatCard title="Present Today" value={loading ? '...' : stats.present.toString()} icon={UserCheck} color="#10b981" bgColor="#ecfdf5" />
        <StatCard title="Absent Today" value={loading ? '...' : (stats.total - stats.present).toString()} icon={UserX} color="#ef4444" bgColor="#fef2f2" />
        <StatCard title="Attendance Rate" value={loading ? '...' : `${Math.round((stats.present / stats.total) * 100) || 0}%`} icon={Clock} color="#f59e0b" bgColor="#fffbeb" />
      </div>

      {/* Filters */}
      <Box className="card-ems-static" sx={{ p: 2, mb: 3 }}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button className="btn-icon-ems" aria-label="Previous day" onClick={() => adjustDate(-1)}><ChevronLeft size={16} /></button>
            <span className="font-bold text-sm px-3">{currentDate.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <button className="btn-icon-ems" aria-label="Next day" onClick={() => adjustDate(1)}><ChevronRight size={16} /></button>
          </div>
          <div className="flex gap-2">
            <select className="form-select-ems" style={{ width: 180 }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Box>

      {/* Table */}
      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table-ems" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th style={{ textAlign: 'center' }}>Punch In</th>
                <th style={{ textAlign: 'center' }}>Punch Out</th>
                <th style={{ textAlign: 'center' }}>Hours</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={6}><Skeleton height={50} sx={{ mx: 2 }} /></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 11 }}>
                        {row.name.charAt(0)}
                      </Avatar>
                      <span className="text-sm font-semibold">{row.name}</span>
                    </div>
                  </td>
                  <td className="text-sm text-slate-500">{row.dept}</td>
                  <td className="text-sm font-medium text-center">{row.in}</td>
                  <td className="text-sm font-medium text-center">{row.out}</td>
                  <td className="text-sm font-semibold text-center">{row.hours}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge-pill ${row.rawStatus === 'punched_in' ? 'success' : row.rawStatus === 'punched_out' ? 'info' : 'danger'}`}>
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-10 text-slate-500">No attendance records found for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
};

export default Attendance;
