import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Trash2, Edit3, Send, Save, Filter, Search, X, FilePlus, MoreVertical, Eye, Download, Info } from 'lucide-react';
import { Box, Chip, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import PageHeader from '../components/PageHeader';

import { leaveService } from '../services/leaveService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Swal from 'sweetalert2';

const MyLeaves = () => {
  const { user } = useAuth();
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState([]);
  
  const [formData, setFormData] = useState({ 
    type: 'Annual', 
    start: '', 
    end: '', 
    reason: '' 
  });

  const balances = [
    { type: 'Annual', total: 12, used: 2, color: '#4f46e5', bg: '#f5f3ff', icon: Calendar },
    { type: 'Sick', total: 10, used: 3, color: '#ef4444', bg: '#fef2f2', icon: AlertCircle },
    { type: 'Unpaid', total: 0, used: 0, color: '#64748b', bg: '#f1f5f9', icon: Clock },
  ];

  // 1. Fetch History on Mount
  const fetchHistory = async () => {
    try {
      if (user?.id) {
        const data = await leaveService.getMyLeaves(user.id);
        setLeaves(data);
      }
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    // REALTIME: Listen for status changes on my requests
    if (user?.id) {
      const channel = supabase
        .channel('my_leave_updates')
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'leave_requests', 
            filter: `user_id=eq.${user.id}` 
          },
          () => fetchHistory()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);


  // 2. Form Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateDays = () => {
    if (!formData.start || !formData.end) return 0;
    const start = new Date(formData.start);
    const end = new Date(formData.end);
    const diff = end - start;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 0;
  };

  const handleSubmit = async () => {
    if (!formData.start || !formData.end || !formData.reason) {
      return Swal.fire('Error', 'Please fill all fields', 'error');
    }

    try {
      setLoading(true);
      await leaveService.applyLeave(user.id, {
        leave_type: formData.type,
        start_date: formData.start,
        end_date: formData.end,
        reason: formData.reason
      });
      
      Swal.fire('Success', 'Leave request submitted!', 'success');
      setShowApplyDialog(false);
      setFormData({ type: 'Annual', start: '', end: '', reason: '' });
      fetchHistory(); // Refresh table
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = leaves.filter(item => {
    const matchesType = activeFilter === 'All' || item.leave_type === activeFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter.toLowerCase();
    return matchesType && matchesStatus;
  });


  return (
    <div>
      <PageHeader title="Leave Management" subtitle="Manage and track your time off requests">
        <button className="btn-ems btn-ems-primary" onClick={() => setShowApplyDialog(true)}>
          <FilePlus size={18} /> Apply for Leave
        </button>
      </PageHeader>

      {/* Leave Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {balances.map((leave, i) => {
          const Icon = leave.icon;
          const usage = (leave.used / leave.total) * 100;
          return (
            <Box key={i} className="card-ems" sx={{ p: 3 }}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: leave.bg, color: leave.color }}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Used: {leave.used} / {leave.total}</span>
              </div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{leave.type}</h3>
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-3xl font-black text-slate-900">{leave.total - leave.used}</span>
                <span className="text-xs font-bold text-slate-400">Days Available</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${usage}%`, backgroundColor: leave.color }} />
              </div>
            </Box>
          );
        })}
      </div>

      {/* History Section */}
      <Box className="card-ems-static" sx={{ p: 0 }}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-base font-bold text-slate-900">Leave History</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" className="form-input-ems !h-9 !text-xs pl-9" placeholder="Search reason..." />
            </div>
            <select className="form-select-ems !h-9 !text-xs" onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="All">All Types</option>
              {balances.map(b => <option key={b.type} value={b.type}>{b.type}</option>)}
            </select>
            <select className="form-select-ems !h-9 !text-xs" onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {filteredHistory.length > 0 ? filteredHistory.map(item => {
            const start = new Date(item.start_date);
            const end = new Date(item.end_date);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            return (
              <div key={item.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group">
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-1.5 h-10 rounded-full" style={{ background: balances.find(b => b.type === item.leave_type)?.color || '#4f46e5' }} />
                  <div className="min-w-[120px]">
                    <h4 className="text-sm font-bold text-slate-900">{item.leave_type}</h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{days} {days > 1 ? 'Days' : 'Day'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-md hidden md:block">{item.reason}</p>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`badge-pill ${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}`}>
                    {item.status.toUpperCase()}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="btn-icon-ems"><Eye size={16}/></button>
                    {item.status === 'pending' && <button className="btn-icon-ems text-indigo-600"><Edit3 size={16}/></button>}
                    <button className="btn-icon-ems text-red-500"><XCircle size={16}/></button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-12 text-center">
              <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No leave records found</h3>
              <p className="text-sm text-slate-500 mb-6">You haven't applied for any leaves yet.</p>
              <button className="btn-ems btn-ems-primary !px-8" onClick={() => setShowApplyDialog(true)}>Apply Now</button>
            </div>
          )}
        </div>
      </Box>

      {/* Apply Leave Dialog */}
      <Dialog open={showApplyDialog} onClose={() => setShowApplyDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Inter', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          Apply for Leave
          <IconButton onClick={() => setShowApplyDialog(false)} size="small"><X size={20} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Leave Type</label>
              <select 
                className="form-select-ems" 
                name="type" 
                value={formData.type} 
                onChange={handleInputChange}
              >
                <option value="Annual">Annual Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Start Date</label>
                <input 
                  type="date" 
                  className="form-input-ems" 
                  name="start" 
                  value={formData.start} 
                  onChange={handleInputChange} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">End Date</label>
                <input 
                  type="date" 
                  className="form-input-ems" 
                  name="end" 
                  value={formData.end} 
                  onChange={handleInputChange} 
                />
              </div>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl flex items-center gap-3 border border-indigo-100">
              <Info size={16} className="text-indigo-600" />
              <span className="text-xs font-bold text-indigo-700">Total Duration: <strong>{calculateDays()} Days</strong></span>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Reason for Leave</label>
              <textarea 
                className="form-input-ems" 
                rows="3" 
                name="reason" 
                value={formData.reason} 
                onChange={handleInputChange} 
                placeholder="Provide a clear reason..."
              ></textarea>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowApplyDialog(false)}>Cancel</button>
          <button className="btn-ems btn-ems-primary !px-8" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </DialogActions>
      </Dialog>

    </div>
  );
};

export default MyLeaves;
