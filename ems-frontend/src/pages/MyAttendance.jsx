import React, { useState } from "react";
import { Calendar, CheckCircle2, Clock, CalendarDays, TrendingUp } from "lucide-react";
import { Box, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useAttendanceHistory, useSubmitAbsenceReason } from '../hooks/useAttendance';
import { useMyLeaves } from '../hooks/useLeaves';
import { toast } from 'react-hot-toast';
const MyAttendance = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState('10');
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [absenceReason, setAbsenceReason] = useState('');

  const getFilterParams = (f) => {
    switch (f) {
      case 'week': {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        return { startDate: monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) };
      }
      case 'month': {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: firstDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) };
      }
      case '30days':
        return { days: 30 };
      default:
        return { limit: 10 };
    }
  };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: history = [], isLoading: historyLoading } = useAttendanceHistory(user?.id, getFilterParams(filter));
  const { data: myLeaves = [] } = useMyLeaves(user?.id);
  const submitAbsenceReasonMutation = useSubmitAbsenceReason();

  // ── Derived Stats ─────────────────────────────────────────────────────────
  const approvedLeaves = myLeaves.filter(l => l.status === 'approved').length;
  const daysPresent = history.filter(h => ['punched_in', 'punched_out', 'auto_punched_out'].includes(h.status)).length;
  const totalHours = history.reduce((acc, h) => acc + (h.total_hours || 0), 0).toFixed(1);

  const stats = [
    { label: "Days Present", value: historyLoading ? '...' : daysPresent.toString(), icon: CheckCircle2, color: "#10b981", bg: "#ecfdf5" },
    { label: "Total Hours", value: historyLoading ? '...' : `${totalHours}h`, icon: Clock, color: "#4f46e5", bg: "#eef2ff" },
    { label: "Leaves Taken", value: historyLoading ? '...' : approvedLeaves.toString(), icon: CalendarDays, color: "#ef4444", bg: "#fef2f2" },
    { label: "Avg. Daily", value: historyLoading ? '...' : (daysPresent > 0 ? (totalHours / daysPresent).toFixed(1) + 'h' : '0h'), icon: TrendingUp, color: "#8b5cf6", bg: "#f5f3ff" },
  ];

  const statusBadgeClass = (status) => {
    if (status === 'punched_in') return 'info';
    if (status === 'punched_out' || status === 'auto_punched_out') return 'success';
    if (status === 'on_leave') return 'info';
    if (status === 'absent_unjustified') return 'danger';
    if (status === 'absent_explanation_pending') return 'warning';
    if (status === 'absent_explained') return 'warning';
    return 'warning';
  };

  const statusLabel = (status) => {
    const labels = {
      punched_in: 'punched in',
      punched_out: 'punched out',
      auto_punched_out: 'auto punched out',
      on_leave: 'on leave',
      absent_unjustified: 'absent !',
      absent_explanation_pending: 'reason pending',
      absent_explained: 'absent explained',
    };
    return labels[status] || status?.replaceAll('_', ' ');
  };

  const openReasonDialog = (row) => {
    setSelectedAttendance(row);
    setAbsenceReason('');
    setReasonDialogOpen(true);
  };

  const handleSubmitReason = async () => {
    if (!selectedAttendance?.id) return;
    if (!absenceReason.trim()) {
      toast.error('Please provide a reason.');
      return;
    }
    try {
      await submitAbsenceReasonMutation.mutateAsync({
        attendanceId: selectedAttendance.id,
        userId: user.id,
        reason: absenceReason.trim(),
      });
      toast.success('Reason submitted for review.');
      setReasonDialogOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to submit reason.');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="My Attendance" subtitle="Track your daily presence and work hours" />

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
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
            <select
              className="form-input-premium !w-40 !h-10 !text-xs !py-0 !bg-slate-50 border-none cursor-pointer hover:bg-slate-100 transition-colors"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="10">Last 10 Records</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="30days">Last 30 Days</option>
            </select>
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
                    <div className="flex items-center gap-2">
                      <span className={`badge-pill ${statusBadgeClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                      {row.status === 'absent_unjustified' && (
                        <button
                          className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-wider"
                          onClick={() => openReasonDialog(row)}
                        >
                          Provide Reason
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      <Dialog open={reasonDialogOpen} onClose={() => setReasonDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Submit Absence Reason</DialogTitle>
        <DialogContent>
          <div className="pt-2">
            <p className="text-xs text-slate-500 mb-3">
              This reason will be reviewed by HR/Admin.
            </p>
            <TextField
              multiline
              minRows={4}
              fullWidth
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              placeholder="Explain why you were absent on this day..."
            />
          </div>
        </DialogContent>
        <DialogActions>
          <button className="btn-ems btn-ems-secondary" onClick={() => setReasonDialogOpen(false)}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={handleSubmitReason} disabled={submitAbsenceReasonMutation.isPending}>
            {submitAbsenceReasonMutation.isPending ? 'Submitting...' : 'Submit Reason'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default MyAttendance;
