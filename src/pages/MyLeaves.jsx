import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Trash2, Edit3, Send, Save, Filter, Search, X, FilePlus, MoreVertical, Eye, Download, Info } from 'lucide-react';
import { Box, Chip, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import PageHeader from '../components/PageHeader';

import { leaveService } from '../services/leaveService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';

const MyLeaves = () => {
  const { user, profile } = useAuth();
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [modalMode, setModalMode] = useState('apply'); // 'apply', 'view', 'edit'
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState(null);
  const [isProbation, setIsProbation] = useState(false);

  const [formData, setFormData] = useState({
    type: 'casual_leave',
    start: '',
    end: '',
    reason: '',
    medicalFile: null
  });

  const [durationPreview, setDurationPreview] = useState({ totalDays: 0, isSandwich: false });

  const leaveTypeConfig = {
    'casual_leave': { label: 'Casual Leave (CL)', color: '#4f46e5', bg: '#f5f3ff', icon: Calendar, max: 20 },
    'sick_leave': { label: 'Medical/Sick Leave (ML/SL)', color: '#ef4444', bg: '#fef2f2', icon: AlertCircle, max: 6 },
    'optional_leave': { label: 'Optional Leave', color: '#f59e0b', bg: '#fffbeb', icon: Clock, max: 2 },
    'lwp': { label: 'Leave Without Pay (LWP)', color: '#64748b', bg: '#f1f5f9', icon: Clock, max: 0 }
  };

  // 1. Fetch History on Mount
  const fetchHistory = async () => {
    try {
      if (user?.id) {
        const [history, balData] = await Promise.all([
          leaveService.getMyLeaves(user.id),
          leaveService.getLeaveBalances(user.id)
        ]);
        setLeaves(history);
        setBalances(balData);

        // Probation Detection: 3 months from joining_date
        if (profile?.joining_date) {
          const joinDate = new Date(profile.joining_date);
          const probationEnd = new Date(joinDate);
          probationEnd.setMonth(joinDate.getMonth() + 3);
          setIsProbation(new Date() < probationEnd);
        }
      }
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
      toast.error('Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id, profile?.joining_date]);

  // Real-time duration preview
  useEffect(() => {
    const updatePreview = async () => {
      if (formData.start && formData.end) {
        const res = await leaveService.calculateLeaveDays(formData.start, formData.end);
        setDurationPreview(res);
      } else {
        setDurationPreview({ totalDays: 0, isSandwich: false });
      }
    };
    updatePreview();
  }, [formData.start, formData.end]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenApply = () => {
    setModalMode('apply');
    setFormData({ type: 'casual_leave', start: '', end: '', reason: '', medicalFile: null });
    setSelectedLeaveId(null);
    setShowApplyDialog(true);
  };

  const handleOpenView = (item) => {
    setModalMode('view');
    setFormData({
      type: item.leave_type,
      start: item.start_date,
      end: item.end_date,
      reason: item.reason,
      medicalFile: null
    });
    setSelectedLeaveId(item.id);
    setShowApplyDialog(true);
  };

  const handleDeleteLeave = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to delete this leave request?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await leaveService.deleteLeave(id);
          toast.success('Leave request deleted successfully');
          fetchHistory();
        } catch (err) {
          toast.error(err.message || 'Failed to delete leave request');
        }
      }
    });
  };

  const handleSubmit = async () => {
    if (!formData.start || !formData.end || !formData.reason) {
      return toast.error('Please fill all fields');
    }

    // Medical Doc check for SL >= 2 days
    if (formData.type === 'sick_leave' && durationPreview.totalDays >= 2 && !formData.medicalFile) {
      return toast.error('Medical Proof Required: Sick leave for 2+ days requires a certificate.');
    }

    try {
      setSubmitting(true);
      let medicalUrl = null;

      if (formData.medicalFile) {
        medicalUrl = await leaveService.uploadMedicalCert(formData.medicalFile, user.id);
      }

      await leaveService.applyLeave(user.id, {
        leave_type: formData.type,
        start_date: formData.start,
        end_date: formData.end,
        reason: formData.reason,
        medical_doc_url: medicalUrl
      });
      toast.success('Leave request submitted!');

      setShowApplyDialog(false);
      setFormData({ type: 'casual_leave', start: '', end: '', reason: '', medicalFile: null });
      fetchHistory();
    } catch (err) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = leaves.filter(item => {
    const matchesType = activeFilter === 'All' || item.leave_type === activeFilter;
    const computedStatus = item.is_deleted ? 'deleted' : item.status.toLowerCase();
    const matchesStatus = statusFilter === 'All' || computedStatus === statusFilter.toLowerCase();
    return matchesType && matchesStatus;
  });


  return (
    <div>
      <PageHeader title="Leave Management" subtitle="Manage and track your time off requests">
        <button className="btn-ems btn-ems-primary" onClick={handleOpenApply}>
          <FilePlus size={18} /> Apply for Leave
        </button>
      </PageHeader>

      {/* Leave Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {balances && Object.entries(leaveTypeConfig).filter(([key]) => key !== 'lwp').map(([key, config]) => {
          const used = key === 'casual_leave' ? balances.cl_used : key === 'sick_leave' ? balances.sl_used : balances.ol_used;
          const total = key === 'casual_leave' ? balances.cl_total + balances.cl_carried : key === 'sick_leave' ? balances.sl_total : balances.ol_total;
          const remaining = total - used;
          const usage = (used / total) * 100;
          const Icon = config.icon;

          return (
            <Box key={key} className="card-ems" sx={{ p: 3 }}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: config.bg, color: config.color }}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Used: {used} / {total}</span>
              </div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{config.label}</h3>
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-3xl font-black text-slate-900">{remaining}</span>
                <span className="text-xs font-bold text-slate-400">Days Available</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${usage}%`, backgroundColor: config.color }} />
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
              {Object.entries(leaveTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select className="form-select-ems !h-9 !text-xs" onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Deleted">Deleted/Canceled</option>
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
                  <div className="w-1.5 h-10 rounded-full" style={{ background: leaveTypeConfig[item.leave_type]?.color || '#4f46e5' }} />
                  <div className="min-w-[120px]">
                    <h4 className="text-sm font-bold text-slate-900">{leaveTypeConfig[item.leave_type]?.label || item.leave_type}</h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.total_days || days} {(item.total_days || days) > 1 ? 'Days' : 'Day'}</span>
                    {item.is_sandwich_applied && (
                      <Chip label="Sandwich" size="small" sx={{ ml: 1, height: 16, fontSize: 8, bgcolor: '#fee2e2', color: '#ef4444', fontWeight: 900 }} />
                    )}
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
                  <span className={`badge-pill ${item.is_deleted ? 'danger' : item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}`}>
                    {item.is_deleted ? 'DELETED' : item.status.toUpperCase()}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="btn-icon-ems" onClick={() => handleOpenView(item)}><Eye size={16} /></button>
                    {!item.is_deleted && (item.status === 'pending' || item.status === 'pending_hr' || item.status === 'pending_super_admin') && <button className="btn-icon-ems text-red-500" onClick={() => handleDeleteLeave(item.id)}><Trash2 size={16} /></button>}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-12 text-center">
              <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No leave records found</h3>
              <p className="text-sm text-slate-500 mb-6">You haven't applied for any leaves yet.</p>
              <button className="btn-ems btn-ems-primary !px-8" onClick={handleOpenApply}>Apply Now</button>
            </div>
          )}
        </div>
      </Box>

      {/* Apply/Edit/View Leave Dialog */}
      <Dialog open={showApplyDialog} onClose={() => setShowApplyDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '20px', p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Inter', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          {modalMode === 'apply' ? 'Apply for Leave' : 'View Leave Details'}
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
                disabled={modalMode === 'view'}
              >
                {Object.entries(leaveTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            {isProbation && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <AlertCircle size={18} className="text-amber-600" />
                <p className="text-[11px] font-bold text-amber-800 leading-tight">
                  PROBATION RULE: During your first 3 months, leaves require manager approval and excess leave may result in salary deduction.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Start Date</label>
                <input
                  type="date"
                  className="form-input-ems"
                  name="start"
                  value={formData.start}
                  onChange={handleInputChange}
                  disabled={modalMode === 'view'}
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
                  disabled={modalMode === 'view'}
                />
              </div>
            </div>
            <div className={`p-3 rounded-xl flex items-center justify-between border ${durationPreview.isSandwich ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center gap-3">
                <Info size={16} className={durationPreview.isSandwich ? 'text-red-600' : 'text-indigo-600'} />
                <span className={`text-xs font-bold ${durationPreview.isSandwich ? 'text-red-700' : 'text-indigo-700'}`}>
                  Total Duration: <strong>{durationPreview.totalDays} Days</strong>
                </span>
              </div>
              {durationPreview.isSandwich && (
                <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">Sandwich Rule Applied</span>
              )}
            </div>

            {formData.type === 'sick_leave' && durationPreview.totalDays >= 2 && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <label className="text-xs font-bold text-blue-700 uppercase tracking-widest block mb-2">Medical Certificate (Mandatory)</label>
                <input
                  type="file"
                  className="text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                  onChange={(e) => setFormData(prev => ({ ...prev, medicalFile: e.target.files[0] }))}
                  accept=".pdf,.jpg,.png,.docx"
                  disabled={modalMode === 'view'}
                />
                <p className="text-[10px] text-blue-500 mt-2">Required for sick leave of 2 or more days.</p>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Reason for Leave</label>
              <textarea
                className="form-input-ems"
                rows="5"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="Provide a clear reason..."
                disabled={modalMode === 'view'}
              ></textarea>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowApplyDialog(false)}>
            {modalMode === 'view' ? 'Close' : 'Cancel'}
          </button>
          {modalMode !== 'view' && (
            <button className="btn-ems btn-ems-primary !px-8" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          )}
        </DialogActions>
      </Dialog>

    </div>
  );
};

export default MyLeaves;
