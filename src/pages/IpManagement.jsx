import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Switch, Chip, Avatar } from '@mui/material';
import { Shield, Plus, Edit2, Trash2, Globe, CheckCircle, XCircle, AlertTriangle, Search, Filter, History } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import { useIpValidity } from '../hooks/useAttendance';


const IpManagement = () => {
  const [ips, setIps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ips'); // 'ips' or 'logs'
  const [open, setOpen] = useState(false);
  const [editingIp, setEditingIp] = useState(null);
  const [formData, setFormData] = useState({ office_name: '', ip_address: '', is_active: true });
  const { data: ipStatus, isLoading: ipStatusLoading } = useIpValidity();


  useEffect(() => {
    fetchIps();
    fetchLogs();
  }, []);

  const fetchIps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('allowed_ips')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) toast.error('Failed to fetch IPs');
    else setIps(data || []);
    setLoading(false);
  };

  const fetchLogs = async () => {
    // Fetch attendance records that have IP info
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id, attendance_date, ip_address, validation_status, validation_reason, is_override,
        profiles!attendance_profiles_user_id_fkey (full_name, employee_id)
      `)
      .not('ip_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) console.error('Failed to fetch logs:', error);
    else setLogs(data || []);
  };

  const handleOpen = (ip = null) => {
    if (ip) {
      setEditingIp(ip);
      setFormData({ office_name: ip.office_name, ip_address: ip.ip_address, is_active: ip.is_active });
    } else {
      setEditingIp(null);
      setFormData({ office_name: '', ip_address: '', is_active: true });
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.office_name || !formData.ip_address) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      if (editingIp) {
        const { error } = await supabase
          .from('allowed_ips')
          .update(formData)
          .eq('id', editingIp.id);
        if (error) throw error;
        toast.success('IP updated successfully');
      } else {
        const { error } = await supabase
          .from('allowed_ips')
          .insert([formData]);
        if (error) throw error;
        toast.success('IP added successfully');
      }
      setOpen(false);
      fetchIps();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete IP?',
      text: "Employees using this IP will no longer be able to punch in.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from('allowed_ips').delete().eq('id', id);
      if (error) toast.error(error.message);
      else {
        toast.success('IP deleted');
        fetchIps();
      }
    }
  };

  const toggleActive = async (ip) => {
    const { error } = await supabase
      .from('allowed_ips')
      .update({ is_active: !ip.is_active })
      .eq('id', ip.id);
    
    if (error) toast.error(error.message);
    else fetchIps();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <PageHeader 
          title="Network Security" 
          subtitle="Manage office IP restrictions and audit attendance connection logs."
        />
        <Button 
          variant="contained" 
          startIcon={<Plus size={18} />}
          onClick={() => handleOpen()}
          sx={{ borderRadius: '12px', py: 1.5, px: 3, boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.25)' }}
        >
          Add Office IP
        </Button>
      </div>

      {/* Current IP Status Banner */}
      <Box className="card-ems-static" sx={{ mb: 4, p: 3, borderLeft: '6px solid #4f46e5', bgcolor: '#f8fafc' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Globe size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Connection Status</h3>
            <div className="flex items-center gap-3">
              <span className="text-xl font-mono font-black text-slate-900 tracking-tighter">
                {ipStatusLoading ? 'Detecting Network...' : ipStatus?.ip || '0.0.0.0'}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${ipStatus?.is_office_network ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {ipStatus?.is_office_network ? 'Office Network' : 'Remote Network'}
              </span>
            </div>
            {!ipStatus?.is_office_network && (
              <p className="text-[11px] text-slate-400 mt-2 font-medium">
                Tip: Whitelist the <b>Detected IP</b> above to enable attendance actions for your network.
              </p>
            )}
          </div>
        </div>
      </Box>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit mb-8 border border-slate-200">
        <button 
          onClick={() => setActiveTab('ips')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'ips' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Allowed Networks
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Access Logs
        </button>
      </div>

      {activeTab === 'ips' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />)
          ) : ips.length === 0 ? (
            <Box className="col-span-full py-20 text-center card-ems-static">
              <Globe size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-slate-500 font-bold">No office networks configured yet.</p>
            </Box>
          ) : ips.map(ip => (
            <Box key={ip.id} className="card-ems-static p-6 hover:shadow-xl transition-all border-l-4" style={{ borderLeftColor: ip.is_active ? '#10b981' : '#cbd5e1' }}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 text-indigo-600 rounded-2xl">
                  <Shield size={24} />
                </div>
                <div className="flex gap-1">
                  <IconButton size="small" onClick={() => handleOpen(ip)} sx={{ color: '#6366f1' }}><Edit2 size={16} /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(ip.id)} sx={{ color: '#ef4444' }}><Trash2 size={16} /></IconButton>
                </div>
              </div>
              
              <h3 className="text-lg font-black text-slate-900 mb-1">{ip.office_name}</h3>
              <p className="text-sm font-mono text-slate-500 mb-6 flex items-center gap-2">
                <Globe size={14} /> {ip.ip_address}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Chip 
                  label={ip.is_active ? 'Active' : 'Disabled'} 
                  size="small" 
                  sx={{ 
                    fontWeight: 800, fontSize: 10, 
                    bgcolor: ip.is_active ? '#ecfdf5' : '#f1f5f9',
                    color: ip.is_active ? '#10b981' : '#64748b'
                  }} 
                />
                <Switch 
                  checked={ip.is_active} 
                  onChange={() => toggleActive(ip)}
                  size="small"
                />
              </div>
            </Box>
          ))}
        </div>
      ) : (
        <Box className="card-ems-static overflow-hidden">
          <div className="table-responsive">
            <table className="table-ems">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Audit Note</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: '#f1f5f9', color: '#4f46e5' }}>
                          {log.profiles?.full_name?.charAt(0)}
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{log.profiles?.full_name}</p>
                          <p className="text-[10px] text-slate-400">{log.profiles?.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs">{log.ip_address}</td>
                    <td>
                      <Chip 
                        label={log.validation_status} 
                        size="small"
                        icon={log.validation_status === 'VALID' ? <CheckCircle size={12} /> : log.is_override ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                        sx={{ 
                          fontWeight: 800, fontSize: 10,
                          bgcolor: log.validation_status === 'VALID' ? '#ecfdf5' : log.is_override ? '#fffbeb' : '#fef2f2',
                          color: log.validation_status === 'VALID' ? '#10b981' : log.is_override ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </td>
                    <td className="text-xs text-slate-500 italic">
                      {log.validation_reason || '--'}
                    </td>
                    <td className="text-xs font-medium text-slate-400">
                      {new Date(log.attendance_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan="5" className="text-center p-10 text-slate-400">No security logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          {editingIp ? 'Edit Office Network' : 'Add New Office Network'}
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <TextField
              fullWidth
              label="Office Name"
              placeholder="e.g. Headquarters, NY Office"
              value={formData.office_name}
              onChange={(e) => setFormData({ ...formData, office_name: e.target.value })}
            />
            <TextField
              fullWidth
              label="IP Address"
              placeholder="e.g. 192.168.1.1 or 203.0.113.1"
              value={formData.ip_address}
              onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#64748b', fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ borderRadius: '10px', fontWeight: 700, px: 3 }}>
            {editingIp ? 'Update' : 'Add Network'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

// Simplified IconButton for this local file
const IconButton = ({ children, onClick, sx }) => (
  <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', ...sx, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '8px' }} className="hover:bg-slate-50 transition-all">
    {children}
  </button>
);

export default IpManagement;
