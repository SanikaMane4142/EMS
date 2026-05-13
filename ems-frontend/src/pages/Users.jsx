import React, { useState } from 'react';
import { Box, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { Shield, Plus, Edit, Trash2, X, Search, User as UserIcon, Mail, Lock, Building, Eye, EyeOff, Calendar, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import PageHeader from '../components/PageHeader';
import RoleBadge from '../components/RoleBadge';
import { profileService } from '../services/profileService';
import { departmentService } from '../services/departmentService';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const UsersPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'employee',
    departmentId: '',
    empIdSuffix: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userList, deptList] = await Promise.all([
        profileService.getAllEmployees(),
        departmentService.getAll()
      ]);
      setUsers(userList || []);
      setDepts(deptList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const filtered = users.filter(u => {
    const matchesStatus = showInactive || u.status === 'active';
    const matchesSearch = (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleDelete = (user) => {
    if (user.id === currentUser.id) {
      toast.error('You cannot delete your own account.');
      return;
    }
    if (user.role === 'super_admin') {
      toast.error('Super Admin accounts must be managed via Supabase directly.');
      return;
    }
    Swal.fire({
      title: 'Delete User?',
      html: `Remove <strong>${user.full_name}</strong> from the system?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setLoading(true);
          // Use employeeService which handles the soft-delete status update
          await employeeService.delete(user.id);
          
          // Optimistic UI update: remove from local state immediately
          setUsers(prev => prev.filter(u => u.id !== user.id));
          
          toast.success('User has been removed (Soft Delete).');
          fetchData();
        } catch (err) {
          console.error(err);
          toast.error('Deletion failed: ' + err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleEditUser = (user) => {
    setEditData({
      id: user.id,
      full_name: user.full_name || '',
      designation: user.designation || '',
      phone: user.phone || '',
      joining_date: user.joining_date || '',
      joined_at: user.joined_at || '',
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      const { id, ...updateData } = editData;
      await profileService.updateProfile(id, updateData);
      toast.success('Profile updated successfully!');
      setShowEditDialog(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Update failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.fullName || !formData.email || !formData.password) {
      toast.error('All fields are required.');
      return;
    }

    try {
      setLoading(true);
      // We will use a special RPC call to create the user on the server
      const { data, error } = await supabase.rpc('admin_create_user', {
        new_email: formData.email,
        new_password: formData.password,
        new_full_name: formData.fullName,
        new_role: formData.role,
        new_department_id: formData.departmentId || null,
        new_employee_id: formData.departmentId 
          ? `${depts.find(d => d.id === formData.departmentId)?.code || 'EMP'}-${formData.empIdSuffix}`
          : formData.empIdSuffix
      });

      if (error) throw error;

      setShowDialog(false);
      setFormData({ fullName: '', email: '', password: '', role: 'employee', departmentId: '', empIdSuffix: '' });
      toast.success('User Created Successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Creation Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="User Management" subtitle="SUPER_ADMIN access — manage system users and roles">
        <button className="btn-ems btn-ems-primary" onClick={() => setShowDialog(true)}>
          <Plus size={16} /> Add User
        </button>
      </PageHeader>

      {/* Role Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Super Admins', count: users.filter(u => u.role === 'super_admin').length, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Admins (HR)', count: users.filter(u => u.role === 'hr').length, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Employees', count: users.filter(u => u.role === 'employee').length, color: '#16a34a', bg: '#f0fdf4' },
        ].map((item, i) => (
          <div key={i} className="text-center p-4 rounded-xl transition-all hover:-translate-y-1 hover:shadow-md" style={{ background: item.bg }}>
            <p className="text-3xl font-extrabold" style={{ color: item.color }}>{item.count}</p>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <Box className="card-ems-static" sx={{ p: 2, mb: 3 }}>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" className="form-input-ems pl-10" placeholder="Search users by name or email..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <input 
              type="checkbox" 
              id="show-inactive"
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <label htmlFor="show-inactive" className="text-xs font-bold text-slate-600 cursor-pointer uppercase tracking-wider">
              Show Deleted/Inactive
            </label>
          </div>
        </div>
      </Box>

      {/* Users Table */}
      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table-ems" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Emp ID</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3,4,5].map(i => <tr key={i}><td colSpan={5}><div className="h-10 bg-slate-100 animate-pulse rounded m-2" /></td></tr>)
              ) : filtered.map(u => (
                <tr key={u.id} className="cursor-pointer" onClick={() => navigate(`/employee/${u.id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar sx={{ width: 36, height: 36, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 13 }}>
                        {u.full_name?.charAt(0) || u.email?.charAt(0)}
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{u.full_name || 'No Name'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {u.employee_id || '---'}
                    </span>
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>
                    <span className={`badge-pill ${u.status === 'active' ? 'success' : 'neutral'}`}>{u.status}</span>
                  </td>
                  <td className="text-sm text-slate-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon-ems" style={{ width: 32, height: 32 }} aria-label={`View ${u.full_name}`} onClick={() => navigate(`/employee/${u.id}`)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn-icon-ems" style={{ width: 32, height: 32 }} aria-label={`Edit ${u.full_name}`} onClick={() => handleEditUser(u)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn-icon-ems" style={{ width: 32, height: 32, color: (u.role === 'super_admin' || u.id === currentUser.id) ? '#cbd5e1' : '#ef4444' }}
                        disabled={u.role === 'super_admin' || u.id === currentUser.id} aria-label={`Delete ${u.full_name}`} onClick={() => handleDelete(u)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {/* Add User Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: 'Inter', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add New User
          <IconButton onClick={() => setShowDialog(false)} size="small"><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="form-input-ems pl-10" placeholder="Enter full name" 
                  value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="form-input-ems pl-10" placeholder="name@company.com" 
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="form-input-ems pl-10 pr-10" 
                  placeholder="Set initial password" 
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Assign Role</label>
              <select className="form-select-ems" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                <option value="employee">Employee</option>
                <option value="hr">Admin (HR)</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Assign Department</label>
              <div className="relative">
                <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  className="form-select-ems pl-10" 
                  value={formData.departmentId} 
                  onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                >
                  <option value="">No Department (Unassigned)</option>
                  {depts.map(d => (
                    <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            {formData.departmentId && (
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Employee ID</label>
                <div className="flex items-center gap-0">
                  <div className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-2 rounded-l-lg text-slate-600 font-bold text-sm">
                    {depts.find(d => d.id === formData.departmentId)?.code || '---'}-
                  </div>
                  <input 
                    type="text" 
                    className="form-input-ems rounded-l-none" 
                    placeholder="e.g. 001" 
                    value={formData.empIdSuffix} 
                    onChange={(e) => setFormData({...formData, empIdSuffix: e.target.value})} 
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">The prefix is automatically mapped from the selected department.</p>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowDialog(false)} disabled={loading}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={handleCreateUser} disabled={loading}>
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: 'Inter', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Edit Employee
          <IconButton onClick={() => setShowEditDialog(false)} size="small"><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
              <input type="text" className="form-input-ems" 
                value={editData.full_name || ''} 
                onChange={(e) => setEditData({...editData, full_name: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Designation</label>
              <input type="text" className="form-input-ems" 
                value={editData.designation || ''} 
                onChange={(e) => setEditData({...editData, designation: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Phone Number</label>
              <input type="tel" className="form-input-ems" 
                value={editData.phone || ''} 
                onChange={(e) => setEditData({...editData, phone: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-2">
                  <Calendar size={14} /> Official Joining
                </label>
                <input type="date" className="form-input-ems" 
                  value={editData.joining_date || ''} 
                  onChange={(e) => setEditData({...editData, joining_date: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-2">
                  <Calendar size={14} /> Portal Joined
                </label>
                <input type="date" className="form-input-ems" 
                  value={editData.joined_at || ''} 
                  onChange={(e) => setEditData({...editData, joined_at: e.target.value})} 
                />
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowEditDialog(false)} disabled={loading}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={handleSaveEdit} disabled={loading}>
            <Save size={16} /> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default UsersPage;
