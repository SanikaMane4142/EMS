import React, { useState, useEffect } from "react";
import { Calendar, CheckCircle2, Clock, Download, AlertCircle, CalendarDays, Play, Square, MoreVertical, TrendingUp } from "lucide-react";
import { Box, Chip, Avatar } from '@mui/material';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

const MyAttendance = () => {
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [punchTime, setPunchTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: "Days Present", value: "18", icon: CheckCircle2, color: "#10b981", bg: "#ecfdf5" },
    { label: "Total Hours", value: "142h", icon: Clock, color: "#4f46e5", bg: "#eef2ff" },
    { label: "Late Arrivals", value: "02", icon: AlertCircle, color: "#f59e0b", bg: "#fffbeb" },
    { label: "Total Leaves", value: "01", icon: CalendarDays, color: "#ef4444", bg: "#fef2f2" },
  ];

  const attendanceHistory = [
    { date: "28 Apr, 2026", punchIn: "08:55 AM", punchOut: "05:30 PM", duration: "8h 35m", status: "Present" },
    { date: "27 Apr, 2026", punchIn: "09:05 AM", punchOut: "06:00 PM", duration: "8h 55m", status: "Late" },
    { date: "26 Apr, 2026", punchIn: "08:45 AM", punchOut: "05:15 PM", duration: "8h 30m", status: "Present" },
  ];

  const handlePunch = () => {
    if (!isPunchedIn) {
      setPunchTime(new Date());
    } else {
      setPunchTime(null);
    }
    setIsPunchedIn(!isPunchedIn);
  };

  return (
    <div>
      <PageHeader title="My Attendance" subtitle="Track your daily presence and work hours" />

      {/* Punch Card Section */}
      <Box className="card-ems-static" sx={{ p: 4, mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <div className="flex items-center gap-6">
          <div className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed ${isPunchedIn ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`w-3 h-3 rounded-full ${isPunchedIn ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-300'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isPunchedIn ? "You are Punched In" : "Ready to start your day?"}</h2>
            <p className="text-sm text-slate-500 font-medium">
              {isPunchedIn ? `Punched in at ${punchTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Please punch in to track your attendance."}
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
          >
            {isPunchedIn ? <><Square size={20} /> Punch Out</> : <><Play size={20} /> Punch In</>}
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
          <button className="btn-ems btn-ems-secondary !h-9 !text-xs">
            <Download size={14} /> Export Report
          </button>
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
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {attendanceHistory.map((row, i) => (
                <tr key={i}>
                  <td>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <Calendar size={18} />
                    </div>
                  </td>
                  <td className="text-sm font-bold text-slate-700">{row.date}</td>
                  <td className="text-sm font-medium text-slate-600">{row.punchIn}</td>
                  <td className="text-sm font-medium text-slate-600">{row.punchOut}</td>
                  <td className="text-sm font-bold text-slate-900">{row.duration}</td>
                  <td>
                    <span className={`badge-pill ${row.status === 'Present' ? 'success' : row.status === 'Late' ? 'warning' : 'danger'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-icon-ems"><MoreVertical size={18} /></button>
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
