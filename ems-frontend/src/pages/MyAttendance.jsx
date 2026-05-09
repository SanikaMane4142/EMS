import React, { useState, useEffect } from "react";
import { Calendar, CheckCircle2, Clock, Download, AlertCircle, CalendarDays, Play, Square, MoreVertical, TrendingUp } from "lucide-react";
import { Box, Chip, Avatar, Skeleton } from '@mui/material';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useActiveAttendance, useAttendanceHistory, usePunchIn, usePunchOut } from '../hooks/useAttendance';
import { useMyLeaves } from '../hooks/useLeaves';

const MyAttendance = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: record, isLoading: attendanceLoading } = useActiveAttendance(user?.id);
  const { data: history = [], isLoading: historyLoading } = useAttendanceHistory(user?.id, 10);
  const { data: myLeaves = [] } = useMyLeaves(user?.id);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const punchInMutation = usePunchIn();
  const punchOutMutation = usePunchOut();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Derived Stats ─────────────────────────────────────────────────────────
  const approvedLeaves = myLeaves.filter(l => l.status === 'approved').length;
  const daysPresent = history.filter(h => h.status !== 'absent').length;
  const totalHours = history.reduce((acc, h) => acc + (h.total_hours || 0), 0).toFixed(1);

  const stats = [
    { label: "Days Present", value: historyLoading ? '...' : daysPresent.toString(), icon: CheckCircle2, color: "#10b981", bg: "#ecfdf5" },
    { label: "Total Hours", value: historyLoading ? '...' : `${totalHours}h`, icon: Clock, color: "#4f46e5", bg: "#eef2ff" },
    { label: "Leaves Taken", value: historyLoading ? '...' : approvedLeaves.toString(), icon: CalendarDays, color: "#ef4444", bg: "#fef2f2" },
    { label: "Avg. Daily", value: historyLoading ? '...' : (daysPresent > 0 ? (totalHours / daysPresent).toFixed(1) + 'h' : '0h'), icon: TrendingUp, color: "#8b5cf6", bg: "#f5f3ff" },
  ];

  const isPunchedIn = record?.status === 'punched_in';

  const handlePunch = async () => {
    try {
      if (!isPunchedIn) {
        await punchInMutation.mutateAsync(user.id);
      } else {
        await punchOutMutation.mutateAsync({
          recordId: record.id,
          punchInTime: record.punch_in_time,
          lunchDurationMs: record.lunch_duration_ms || 0
        });
      }
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="My Attendance" subtitle="Track your daily presence and work hours" />

      {/* Punch Card Section */}
      <Box className="card-ems-static" sx={{ p: 4, mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <div className="flex items-center gap-6">
          <div className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed ${isPunchedIn ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`w-3 h-3 rounded-full ${isPunchedIn ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-300'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {attendanceLoading ? "Checking status..." : isPunchedIn ? "You are Punched In" : "Ready to start your day?"}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {isPunchedIn
                ? `Punched in at ${new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : "Please punch in to track your attendance."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900 tabular-nums">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          </div>
          <button
            className={`btn-ems h-14 px-8 text-base shadow-lg transition-all ${isPunchedIn ? 'btn-ems-danger !shadow-red-200' : 'btn-ems-primary !shadow-indigo-200'}`}
            onClick={handlePunch}
            disabled={attendanceLoading || punchInMutation.isPending || punchOutMutation.isPending}
          >
            {punchInMutation.isPending || punchOutMutation.isPending
              ? "Processing..."
              : isPunchedIn ? <><Square size={20} /> Punch Out</> : <><Play size={20} /> Punch In</>}
          </button>
        </div>
      </Box>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <StatCard key={i} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color} bgColor={stat.bg} />
        ))}
      </div>

      {/* History Table */}
      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Attendance History</h2>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table-ems" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}></th>
                <th>Date</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan="6"><Skeleton height={40} /></td>
                  </tr>
                ))
              ) : history.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-8 text-slate-400">No history found</td></tr>
              ) : history.map((row, i) => (
                <tr key={i}>
                  <td>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto transition-colors">
                      <Calendar size={18} />
                    </div>
                  </td>
                  <td className="text-sm font-bold text-slate-700">
                    {new Date(row.attendance_date + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="text-sm font-medium text-slate-600">
                    {row.punch_in_time ? new Date(row.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </td>
                  <td className="text-sm font-medium text-slate-600">
                    {row.punch_out_time ? new Date(row.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </td>
                  <td className="text-sm font-bold text-slate-900">
                    {row.total_hours ? `${row.total_hours}h` : row.status === 'punched_in' ? 'Ongoing' : '--'}
                  </td>
                  <td>
                    <span className={`badge-pill ${row.status === 'punched_in' ? 'info' : 'success'}`}>
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
};

export default MyAttendance;
