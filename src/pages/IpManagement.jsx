import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Switch, Chip, Avatar } from '@mui/material';
import { Shield, Plus, Edit2, Trash2, Globe, CheckCircle, XCircle, AlertTriangle, History, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import { useIpValidity, useHeartbeatStatus, useIpChangeLogs } from '../hooks/useAttendance';


// ---------------------------------------------------------------------------
// Heartbeat freshness helper
// ---------------------------------------------------------------------------
const getHeartbeatFreshness = (lastHeartbeatAt) => {
  if (!lastHeartbeatAt) return { label: 'Never', color: '#ef4444', bg: '#fef2f2', icon: 'red', ageMin: null };
  const ageMs  = Date.now() - new Date(lastHeartbeatAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);

  if (ageMin < 6)  return { label: `${ageMin}m ago`, color: '#10b981', bg: '#ecfdf5', icon: 'green', ageMin };
  if (ageMin < 16) return { label: `${ageMin}m ago`, color: '#f59e0b', bg: '#fffbeb', icon: 'yellow', ageMin };
  return { label: `${ageMin}m ago — STALE`, color: '#ef4444', bg: '#fef2f2', icon: 'red', ageMin };
};


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const IpManagement = () => {
  const [ips, setIps]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('heartbeat'); // 'heartbeat' | 'ips' | 'logs' | 'changes'
  const [open, setOpen]           = useState(false);
  const [editingIp, setEditingIp] = useState(null);
  const [formData, setFormData]   = useState({ office_name: '', ip_address: '', is_active: true });

  const { data: ipStatus,     isLoading: ipStatusLoading }    = useIpValidity();
  const { data: heartbeat,    isLoading: heartbeatLoading,
          refetch: refetchHB }                                  = useHeartbeatStatus();
  const { data: changeLogs,   isLoading: changeLogsLoading }  = useIpChangeLogs(50);

  // Access logs from attendance table
  const [logs, setLogs] = useState([]);

  useEffect(() => { fetchIps(); fetchLogs(); }, []);

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
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id, attendance_date, ip_address, validation_status, validation_reason,
        validation_method, is_override,
        profiles!attendance_profiles_user_id_fkey (full_name, employee_id)
      `)
      .not('ip_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.error('Failed to fetch logs:', error);
    else setLogs(data || []);
  };

  const handleOpen = (ip = null) => {
    if (ip) { setEditingIp(ip); setFormData({ office_name: ip.office_name, ip_address: ip.ip_address, is_active: ip.is_active }); }
    else    { setEditingIp(null); setFormData({ office_name: '', ip_address: '', is_active: true }); }
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.office_name || !formData.ip_address) { toast.error('Please fill all fields'); return; }
    try {
      if (editingIp) {
        const { error } = await supabase.from('allowed_ips').update(formData).eq('id', editingIp.id);
        if (error) throw error;
        toast.success('IP updated');
      } else {
        const { error } = await supabase.from('allowed_ips').insert([formData]);
        if (error) throw error;
        toast.success('IP added');
      }
      setOpen(false); fetchIps();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({ title: 'Delete IP?', text: 'Employees using this IP can no longer punch in.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, Delete' });
    if (result.isConfirmed) {
      const { error } = await supabase.from('allowed_ips').delete().eq('id', id);
      if (error) toast.error(error.message); else { toast.success('IP deleted'); fetchIps(); }
    }
  };

  const toggleActive = async (ip) => {
    const { error } = await supabase.from('allowed_ips').update({ is_active: !ip.is_active }).eq('id', ip.id);
    if (error) toast.error(error.message); else fetchIps();
  };

  const freshness = getHeartbeatFreshness(heartbeat?.last_heartbeat_at);

  const TABS = [
    { id: 'heartbeat', label: 'Heartbeat Status' },
    { id: 'ips',       label: 'Allowed Networks'  },
    { id: 'changes',   label: 'IP Change History'  },
    { id: 'logs',      label: 'Access Logs'        },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <PageHeader
          title="Network Security"
          subtitle="Automated office IP heartbeat — zero manual updates needed."
        />
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => handleOpen()}
          sx={{ borderRadius: '12px', py: 1.5, px: 3, boxShadow: '0 8px 16px -4px rgba(79,70,229,0.25)' }}
        >
          Add Fallback IP
        </Button>
      </div>

      {/* ── Current Employee Connection Status ── */}
      <Box className="card-ems-static" sx={{ mb: 3, p: 3, borderLeft: '6px solid #4f46e5', bgcolor: '#f8fafc' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Globe size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Your Current Connection</h3>
            <div className="flex items-center gap-3">
              <span className="text-xl font-mono font-black text-slate-900 tracking-tighter">
                {ipStatusLoading ? 'Detecting...' : ipStatus?.ip || '—'}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${ipStatus?.is_office_network ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {ipStatus?.is_office_network ? '✓ Office Network' : '✗ Remote Network'}
              </span>
              {ipStatus?.validation_source && (
                <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wide">
                  via {ipStatus.validation_source.replace(/_/g, ' ')}
                </span>
              )}
              {ipStatus?.validation_source === 'fallback_stale_heartbeat' && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-100 text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Stale Heartbeat Fallback Active
                </span>
              )}
            </div>
          </div>
        </div>
      </Box>

      {/* ── Tabs ── */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit mb-8 border border-slate-200 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* TAB: HEARTBEAT STATUS                                               */}
      {/* ================================================================== */}
      {activeTab === 'heartbeat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Main heartbeat card */}
          <Box className="card-ems-static p-6" sx={{ borderLeft: `6px solid ${freshness.color}` }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: freshness.bg }}>
                  <Activity size={24} style={{ color: freshness.color }} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Office Heartbeat</h3>
                  <p className="text-base font-black text-slate-900">Auto IP Sync</p>
                </div>
              </div>
              <button
                onClick={() => refetchHB()}
                className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600"
                title="Refresh heartbeat status"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {heartbeatLoading ? (
              <div className="space-y-3">
                <div className="h-8 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-6 bg-slate-100 rounded-xl animate-pulse w-3/4" />
              </div>
            ) : heartbeat ? (
              <>
                {/* Current IP */}
                <div className="mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Office IP</p>
                  <p className="text-2xl font-mono font-black text-slate-900">{heartbeat.current_ip}</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Last Beat</p>
                    <p className="text-sm font-black" style={{ color: freshness.color }}>{freshness.label}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Total Beats</p>
                    <p className="text-sm font-black text-slate-700">{heartbeat.heartbeat_count?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Status</p>
                    <p className="text-sm font-black" style={{ color: freshness.color }}>
                      {freshness.ageMin < 6 ? 'Healthy' : freshness.ageMin < 16 ? 'Delayed' : 'Stale'}
                    </p>
                  </div>
                </div>

                {/* Previous IP */}
                {heartbeat.previous_ip && (
                  <div className="flex items-center gap-2 py-3 border-t border-slate-100">
                    <History size={14} className="text-slate-300" />
                    <span className="text-xs text-slate-400">Previous IP:</span>
                    <span className="text-xs font-mono text-slate-500">{heartbeat.previous_ip}</span>
                    {heartbeat.ip_changed_at && (
                      <span className="text-[10px] text-slate-300">
                        changed {new Date(heartbeat.ip_changed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Office name */}
                <div className="flex items-center gap-2 mt-2">
                  <Shield size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-slate-500">{heartbeat.office_name}</span>
                  <span className="text-[10px] text-slate-300 font-mono">({heartbeat.office_id})</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <WifiOff size={40} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-bold text-slate-500">No heartbeat detected</p>
                <p className="text-xs text-slate-400 mt-1">Deploy the office-heartbeat service on your office PC</p>
              </div>
            )}
          </Box>

          {/* Setup guide card */}
          <Box className="card-ems-static p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Wifi size={24} />
              </div>
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quick Setup</h3>
                <p className="text-base font-black text-slate-900">Office Server</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-black text-[10px] flex items-center justify-center flex-shrink-0">1</span>
                <p>On the office PC, copy <code className="bg-slate-100 px-1 rounded text-[10px]">office-heartbeat/.env.example</code> → <code className="bg-slate-100 px-1 rounded text-[10px]">.env</code></p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-black text-[10px] flex items-center justify-center flex-shrink-0">2</span>
                <p>Set your <code className="bg-slate-100 px-1 rounded text-[10px]">SUPABASE_SERVICE_ROLE_KEY</code> (never the anon key)</p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-black text-[10px] flex items-center justify-center flex-shrink-0">3</span>
                <p>Run <code className="bg-slate-100 px-1 rounded text-[10px]">npm install && npm start</code> — heartbeat begins immediately</p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-black text-[10px] flex items-center justify-center flex-shrink-0">✓</span>
                <p className="text-emerald-700 font-semibold">IP syncs automatically every 5 minutes — no manual updates ever again</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fallback Behavior</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Heartbeat fresh (<15 min)', status: 'Uses heartbeat IP', ok: true },
                  { label: 'Heartbeat stale (>15 min)',  status: 'Falls back to Allowed Networks', ok: false },
                  { label: 'No heartbeat at all',         status: 'Uses Allowed Networks only', ok: false },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50">
                    <span className="text-[11px] text-slate-500">{row.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${row.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </Box>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: ALLOWED NETWORKS (fallback IPs)                                */}
      {/* ================================================================== */}
      {activeTab === 'ips' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />)
          ) : ips.length === 0 ? (
            <Box className="col-span-full py-20 text-center card-ems-static">
              <Globe size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-slate-500 font-bold">No fallback networks configured.</p>
              <p className="text-slate-400 text-sm mt-1">These are used when the heartbeat server is offline.</p>
            </Box>
          ) : ips.map(ip => (
            <Box key={ip.id} className="card-ems-static p-6 hover:shadow-xl transition-all border-l-4" style={{ borderLeftColor: ip.is_active ? '#10b981' : '#cbd5e1' }}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 text-indigo-600 rounded-2xl"><Shield size={24} /></div>
                <div className="flex gap-1">
                  <IconButton size="small" onClick={() => handleOpen(ip)} sx={{ color: '#6366f1' }}><Edit2 size={16} /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(ip.id)} sx={{ color: '#ef4444' }}><Trash2 size={16} /></IconButton>
                </div>
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">{ip.office_name}</h3>
              <p className="text-sm font-mono text-slate-500 mb-6 flex items-center gap-2"><Globe size={14} /> {ip.ip_address}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Chip label={ip.is_active ? 'Active' : 'Disabled'} size="small"
                  sx={{ fontWeight: 800, fontSize: 10, bgcolor: ip.is_active ? '#ecfdf5' : '#f1f5f9', color: ip.is_active ? '#10b981' : '#64748b' }} />
                <Switch checked={ip.is_active} onChange={() => toggleActive(ip)} size="small" />
              </div>
            </Box>
          ))}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: IP CHANGE HISTORY                                              */}
      {/* ================================================================== */}
      {activeTab === 'changes' && (
        <Box className="card-ems-static overflow-hidden">
          <div className="table-responsive">
            <table className="table-ems">
              <thead>
                <tr>
                  <th>Office</th>
                  <th>Old IP</th>
                  <th>New IP</th>
                  <th>Source</th>
                  <th>Changed At</th>
                </tr>
              </thead>
              <tbody>
                {changeLogsLoading ? (
                  <tr><td colSpan="5" className="text-center p-10 text-slate-400">Loading...</td></tr>
                ) : changeLogs?.length === 0 ? (
                  <tr><td colSpan="5" className="text-center p-10 text-slate-400">No IP changes recorded yet.</td></tr>
                ) : changeLogs?.map(log => (
                  <tr key={log.id}>
                    <td className="font-bold text-slate-700">{log.office_id}</td>
                    <td className="font-mono text-xs text-slate-400">{log.old_ip || '—'}</td>
                    <td className="font-mono text-xs font-bold text-slate-800">{log.new_ip}</td>
                    <td>
                      <Chip
                        label={log.change_source?.replace(/_/g, ' ')}
                        size="small"
                        sx={{
                          fontWeight: 800, fontSize: 10,
                          bgcolor: log.change_source === 'heartbeat_auto' ? '#ecfdf5' : log.change_source === 'admin_override' ? '#fffbeb' : '#f1f5f9',
                          color:   log.change_source === 'heartbeat_auto' ? '#10b981' : log.change_source === 'admin_override' ? '#f59e0b' : '#64748b',
                        }}
                      />
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(log.changed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {/* ================================================================== */}
      {/* TAB: ACCESS LOGS                                                    */}
      {/* ================================================================== */}
      {activeTab === 'logs' && (
        <Box className="card-ems-static overflow-hidden">
          <div className="table-responsive">
            <table className="table-ems">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>IP Address</th>
                  <th>Method</th>
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
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-wide">
                        {log.validation_method?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td>
                      <Chip
                        label={log.validation_status}
                        size="small"
                        icon={log.validation_status === 'VALID' ? <CheckCircle size={12} /> : log.is_override ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                        sx={{
                          fontWeight: 800, fontSize: 10,
                          bgcolor: log.validation_status === 'VALID' ? '#ecfdf5' : log.is_override ? '#fffbeb' : '#fef2f2',
                          color:   log.validation_status === 'VALID' ? '#10b981' : log.is_override ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </td>
                    <td className="text-xs text-slate-500 italic">{log.validation_reason || '—'}</td>
                    <td className="text-xs font-medium text-slate-400">
                      {new Date(log.attendance_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan="6" className="text-center p-10 text-slate-400">No security logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {/* Add/Edit Fallback IP Modal */}
      <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          {editingIp ? 'Edit Fallback Network' : 'Add Fallback Network'}
        </DialogTitle>
        <DialogContent>
          <p className="text-xs text-slate-400 mb-4 -mt-1">
            Fallback networks are used when the heartbeat server is offline (&gt;15 min stale).
          </p>
          <div className="flex flex-col gap-4 pt-2">
            <TextField fullWidth label="Office Name" placeholder="e.g. Main Office Fallback"
              value={formData.office_name} onChange={(e) => setFormData({ ...formData, office_name: e.target.value })} />
            <TextField fullWidth label="IP Address" placeholder="e.g. 203.0.113.1"
              value={formData.ip_address} onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })} />
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
