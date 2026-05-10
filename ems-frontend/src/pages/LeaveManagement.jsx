import React, { useState, useEffect } from 'react';
import { Box, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Skeleton } from '@mui/material';
import { Calendar, Check, X, Clock, CalendarOff, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import PageHeader from '../components/PageHeader';
import { leaveService } from '../services/leaveService';
import { departmentService } from '../services/departmentService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const LeaveManagement = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('Pending');
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'casual_leave', start: '', end: '', reason: '' });

  const leaveTypeConfig = {
    'casual_leave': { label: 'Casual Leave (CL)', color: '#4f46e5', bg: '#f5f3ff' },
    'sick_leave': { label: 'Medical/Sick Leave (ML/SL)', color: '#ef4444', bg: '#fef2f2' },
    'optional_leave': { label: 'Optional Leave', color: '#f59e0b', bg: '#fffbeb' },
    'lwp': { label: 'Leave Without Pay (LWP)', color: '#64748b', bg: '#f1f5f9' }
  };

  const fetchAllRequests = async () => {
    try {
      setLoading(true);
      const data = await leaveService.getAllRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();

    const channel = supabase
      .channel('hr_leave_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchAllRequests())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusUpdate = async (requestId, status) => {
    try {
      setLoading(true);
      await leaveService.updateStatus(requestId, status, user.id, profile.role);
      fetchAllRequests();
      toast.success(status === 'approved' ? 'Leave Approved' : 'Leave Rejected');
    } catch (err) {
      toast.error('Action failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setSubmitting(true);
      await leaveService.applyLeave(user.id, {
        leave_type: leaveForm.type,
        start_date: leaveForm.start,
        end_date: leaveForm.end,
        reason: leaveForm.reason
      });
      toast.success('Leave request submitted!');
      setShowApplyDialog(false);
      setLeaveForm({ type: 'Sick Leave', start: '', end: '', reason: '' });
      fetchAllRequests();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLeaves = requests.filter(req => {
    if (activeTab === 'Pending') return req.status.startsWith('pending');
    return req.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="Leave Management" subtitle="Manage employee leave requests">
        <button className="btn-ems btn-ems-primary" onClick={() => setShowApplyDialog(true)}>
          <Plus size={16} /> Apply Leave
        </button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Approved', count: requests.filter(r => r.status === 'approved').length, color: '#10b981', bg: '#ecfdf5' },
          { label: 'Pending', count: requests.filter(r => r.status.startsWith('pending')).length, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length, color: '#ef4444', bg: '#fef2f2' },
        ].map((item, i) => (
          <div key={i} className="text-center p-4 rounded-xl" style={{ background: item.bg }}>
            <p className="text-3xl font-extrabold" style={{ color: item.color }}>{item.count}</p>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs-ems mb-6">
        {['Pending', 'Approved', 'Rejected'].map(tab => (
          <button key={tab} className={`tab-ems ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
            {tab === 'Pending' && requests.filter(r => r.status.startsWith('pending')).length > 0 && (
              <span className="ml-2 text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                {requests.filter(r => r.status.startsWith('pending')).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leave Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          [1,2].map(i => <Skeleton key={i} variant="rounded" height={200} />)
        ) : filteredLeaves.length > 0 ? filteredLeaves.map(leave => {
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          const name = leave.profiles?.full_name || leave.profiles?.email || 'User';

          return (
            <Box key={leave.id} className="card-ems" sx={{ p: 3, borderLeft: leave.status.startsWith('pending') ? '4px solid #f59e0b' : 'none' }}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <Avatar sx={{ width: 44, height: 44, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700 }}>{name.charAt(0)}</Avatar>
                  <div>
                    <p className="text-base font-bold text-slate-900">{name}</p>
                    <p className="text-xs font-bold text-indigo-600">{leaveTypeConfig[leave.leave_type]?.label || leave.leave_type}</p>
                  </div>
                </div>
                <span className={`badge-pill ${leave.status.startsWith('pending') ? 'warning' : leave.status === 'approved' ? 'success' : 'danger'}`}>
                  {leave.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              
              <div className="p-3 rounded-xl mb-3 bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                    <Calendar size={14} className="text-slate-400" /> {start.toLocaleDateString()} - {end.toLocaleDateString()}
                    <span className="text-xs text-indigo-600 font-black ml-1">({leave.total_days || days} days)</span>
                  </div>
                  {leave.is_sandwich_applied && (
                    <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase">Sandwich Rule</span>
                  )}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">{leave.reason}</p>
                
                {leave.medical_doc_url && (
                  <a href={leave.medical_doc_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:underline bg-blue-50 px-2 py-1 rounded-lg">
                    <Check size={12} /> View Medical Certificate
                  </a>
                )}
              </div>

              {/* Approval Info */}
              <div className="flex flex-col gap-1 mb-4 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Sent: {new Date(leave.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                {leave.status === 'approved' && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase">
                      <Check size={12} /> Approved by: {leave.super_admin?.full_name || 'Super Admin'}
                    </div>
                    {leave.super_admin_action_at && (
                      <div className="text-[9px] text-slate-400 ml-5 font-medium">
                        {new Date(leave.super_admin_action_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                )}
                {leave.status === 'rejected' && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-red-600 uppercase">
                      <X size={12} /> Rejected by: {(leave.super_admin || leave.hr)?.full_name || 'Admin'}
                    </div>
                    <div className="text-[9px] text-slate-400 ml-5 font-medium">
                      {new Date(leave.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                )}
                {leave.status === 'pending_super_admin' && leave.hr && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase">
                      <Check size={12} /> Approved by HR, Pending from Admin
                    </div>
                    {leave.hr_action_at && (
                      <div className="text-[9px] text-slate-400 ml-5 font-medium">
                        {new Date(leave.hr_action_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {((leave.status === 'pending_hr' && (profile.role === 'hr' || profile.role === 'admin')) || 
                (leave.status === 'pending_super_admin' && profile.role === 'super_admin')) && (
                <div className="flex gap-2">
                  <button className="btn-ems btn-ems-success flex-1" onClick={() => handleStatusUpdate(leave.id, 'approved')}>
                    <Check size={16} /> {leave.status === 'pending_hr' ? 'Approve to Next' : 'Final Approve'}
                  </button>
                  <button className="btn-ems btn-ems-outline flex-1" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleStatusUpdate(leave.id, 'rejected')}>
                    <X size={16} /> Reject
                  </button>
                </div>
              )}
            </Box>
          );
        }) : (
          <div className="col-span-2 py-12 text-center text-slate-500">
             <CalendarOff size={48} className="mx-auto mb-4 opacity-20" />
             <p>No {activeTab.toLowerCase()} requests found.</p>
          </div>
        )}
      </div>

      {/* Apply Leave Dialog */}
      <Dialog open={showApplyDialog} onClose={() => setShowApplyDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Apply for Leave
          <IconButton onClick={() => setShowApplyDialog(false)} size="small"><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Leave Type</label>
              <select className="form-select-ems" value={leaveForm.type} onChange={(e) => setLeaveForm({...leaveForm, type: e.target.value})}>
                {Object.entries(leaveTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">From Date</label>
                <input type="date" className="form-input-ems" value={leaveForm.start} onChange={(e) => setLeaveForm({...leaveForm, start: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">To Date</label>
                <input type="date" className="form-input-ems" value={leaveForm.end} onChange={(e) => setLeaveForm({...leaveForm, end: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Reason</label>
              <textarea className="form-input-ems" rows="3" placeholder="Describe the reason..." value={leaveForm.reason} onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})} />
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowApplyDialog(false)}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={handleApply} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;
