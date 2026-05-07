import React, { useState, useEffect } from 'react';
import { Box, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Skeleton } from '@mui/material';
import { Search, Plus, MoreVertical, X, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import PageHeader from '../components/PageHeader';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';

const Employees = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empData, deptData] = await Promise.all([
        employeeService.getAll(),
        departmentService.getAll()
      ]);
      setEmployees(empData);
      setDepartments(deptData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = employees.filter(emp => {
    const name = emp.full_name || emp.email || '';
    const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = departmentFilter === 'all' || emp.departments?.name === departmentFilter;
    return matchSearch && matchDept;
  });

  const handleDelete = (emp) => {
    Swal.fire({
      title: 'Delete Employee?',
      html: `Are you sure you want to remove <strong>${emp.full_name || emp.email}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire('Note', 'Delete logic coming soon!', 'info');
      }
    });
  };

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="Employees" subtitle={`${employees.length} total employees`}>
        <button className="btn-ems btn-ems-primary" onClick={() => setShowAddDialog(true)}>
          <Plus size={16} /> Add Employee
        </button>
      </PageHeader>

      {/* Filters */}
      <Box className="card-ems-static" sx={{ p: 2, mb: 3 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" className="form-input-ems pl-10"
              placeholder="Search employees..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="form-select-ems" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
          <select className="form-select-ems">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
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
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={5}><Skeleton height={50} sx={{ mx: 2 }} /></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? filtered.map(emp => {
                const name = emp.full_name || emp.email.split('@')[0];
                return (
                  <tr key={emp.id} className="cursor-pointer" onClick={() => navigate(`/employee/${emp.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar sx={{ width: 36, height: 36, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 13 }}>
                          {name.charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{emp.full_name || 'Incomplete Profile'}</p>
                          <p className="text-xs text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-slate-500">{emp.departments?.name || 'Unassigned'}</td>
                    <td className="text-sm text-slate-500 font-medium">{emp.designation || 'Employee'}</td>
                    <td>
                      <span className={`badge-pill ${emp.status === 'active' ? 'success' : 'danger'}`}>
                        {(emp.status || 'active').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-icon-ems" style={{ width: 32, height: 32 }} aria-label={`View ${name}`} onClick={() => navigate(`/employee/${emp.id}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn-icon-ems" style={{ width: 32, height: 32 }} aria-label={`Edit ${name}`}>
                          <Edit size={14} />
                        </button>
                        <button className="btn-icon-ems" style={{ width: 32, height: 32, color: '#ef4444' }} aria-label={`Delete ${name}`} onClick={() => handleDelete(emp)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5} className="text-center py-10 text-slate-500">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Box>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: 'Inter', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add New Employee
          <IconButton onClick={() => setShowAddDialog(false)} size="small"><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
              <input type="text" className="form-input-ems" placeholder="Enter full name" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email Address</label>
              <input type="email" className="form-input-ems" placeholder="name@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department</label>
                <select className="form-select-ems">
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Designation</label>
                <input type="text" className="form-input-ems" placeholder="Job title" />
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowAddDialog(false)}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={() => {
            setShowAddDialog(false);
            Swal.fire({ title: 'Employee Added!', text: 'User must sign up with this email.', icon: 'success' });
          }}>Add Employee</button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Employees;
