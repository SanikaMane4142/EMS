import React, { useState } from 'react';
import { Box, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip } from '@mui/material';
import { Search, Plus, X, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { useEmployees, useDeleteEmployee } from '../hooks/useEmployees';
import { useDepartments } from '../hooks/useDepartments';

const Employees = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const { data: departments = [] } = useDepartments();
  const deleteEmployee = useDeleteEmployee();

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
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteEmployee.mutateAsync(emp.id);
          Swal.fire('Deleted!', 'Employee has been removed.', 'success');
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  const columns = [
    {
      field: 'employee',
      headerName: 'Employee',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => {
        const emp = params.row;
        const name = emp.full_name || emp.email.split('@')[0];
        return (
          <div 
            className="flex items-center gap-3 h-full cursor-pointer w-full" 
            onClick={() => navigate(`/employee/${emp.id}`)}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 13 }}>
              {name.charAt(0).toUpperCase()}
            </Avatar>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-semibold text-slate-900">{emp.full_name || 'Incomplete Profile'}</span>
              <span className="text-xs text-slate-500">{emp.email}</span>
            </div>
          </div>
        );
      }
    },
    { 
      field: 'dept', 
      headerName: 'Department', 
      flex: 1, 
      minWidth: 150,
      valueGetter: (value, row) => row?.departments?.name || 'Unassigned',
      renderCell: (params) => <span className="text-sm text-slate-500">{params.value}</span>
    },
    { 
      field: 'designation', 
      headerName: 'Role', 
      flex: 1, 
      minWidth: 150,
      valueGetter: (value, row) => row?.designation || 'Employee',
      renderCell: (params) => <span className="text-sm text-slate-500 font-medium">{params.value}</span>
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const status = params.row.status || 'active';
        return (
          <Chip 
            label={status.toUpperCase()} 
            color={status === 'active' ? 'success' : 'error'} 
            size="small" 
            sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24 }}
          />
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params) => {
        const emp = params.row;
        const name = emp.full_name || emp.email.split('@')[0];
        return (
          <div className="flex items-center justify-end gap-1 h-full w-full">
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
        );
      }
    }
  ];

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
        <DataTable 
          columns={columns} 
          data={filtered} 
          loading={loadingEmployees} 
          emptyMessage="No employees found."
        />
      </Box>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}>
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
