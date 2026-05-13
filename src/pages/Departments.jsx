import React, { useState, useEffect } from 'react';

import { Box, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { Building, Users, Plus, Edit, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';
import PageHeader from '../components/PageHeader';

import { departmentService } from '../services/departmentService';

const Departments = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDept, setNewDept] = useState({ name: '', code: '', description: '' });
  const [editingId, setEditingId] = useState(null);

  const fetchDepartments = async () => {
    try {
      const data = await departmentService.getAll();
      setDepartments(data);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (editingId) {
        await departmentService.update(editingId, newDept);
        Swal.fire('Success', 'Department updated!', 'success');
      } else {
        await departmentService.create(newDept);
        Swal.fire('Success', 'Department created!', 'success');
      }
      setShowDialog(false);
      setNewDept({ name: '', code: '', description: '' });
      setEditingId(null);
      fetchDepartments();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (dept) => {
    setNewDept({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || ''
    });
    setEditingId(dept.id);
    setShowDialog(true);
  };

  const handleDelete = (dept) => {
    Swal.fire({
      title: 'Delete Department?',
      html: `Remove <strong>${dept.name}</strong> department?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await departmentService.delete(dept.id);
          Swal.fire('Deleted!', 'Department removed.', 'success');
          fetchDepartments();
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };


  return (
    <div>
      <PageHeader title="Departments" subtitle={`${departments.length} departments · ${departments.reduce((a, d) => a + d.employees, 0)} total employees`}>
        <button className="btn-ems btn-ems-primary" onClick={() => setShowDialog(true)}>
          <Plus size={16} /> Add Department
        </button>
      </PageHeader>

      {/* Department Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full text-center py-10 text-slate-500 font-medium">Loading departments...</div>
        ) : departments.length > 0 ? departments.map(dept => (
          <Box key={dept.id} className="card-ems" sx={{ p: 0, overflow: 'hidden' }}>
            {/* Card Header */}
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="text-3xl p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Building size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                      {dept.code && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">{dept.code}</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-[150px]">{dept.description}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-icon-ems" style={{ width: 28, height: 28 }} aria-label={`Edit ${dept.name}`}
                    onClick={() => openEditDialog(dept)}>
                    <Edit size={13} />
                  </button>
                  <button className="btn-icon-ems" style={{ width: 28, height: 28, color: '#ef4444' }} aria-label={`Delete ${dept.name}`}
                    onClick={() => handleDelete(dept)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-slate-400" />
                <span className="text-sm font-bold text-indigo-600">{dept.employee_count?.[0]?.count || 0}</span>
                <span className="text-xs text-slate-500">employees</span>
              </div>
            </div>
          </Box>
        )) : (
          <div className="col-span-full text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-500 font-bold">No departments found. Add your first one!</p>
          </div>
        )}
      </div>


      {/* Add Department Dialog */}
      <Dialog open={showDialog} onClose={() => { setShowDialog(false); setEditingId(null); setNewDept({ name: '', code: '', description: '' }); }} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: 'Inter', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingId ? 'Edit Department' : 'Add Department'}
          <IconButton onClick={() => { setShowDialog(false); setEditingId(null); setNewDept({ name: '', code: '', description: '' }); }} size="small"><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department Name</label>
              <input 
                type="text" className="form-input-ems" placeholder="e.g., Marketing" 
                value={newDept.name} onChange={(e) => setNewDept({...newDept, name: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department Code</label>
              <input 
                type="text" className="form-input-ems" placeholder="e.g., MKGT" 
                value={newDept.code} onChange={(e) => setNewDept({...newDept, code: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Description</label>
              <textarea 
                className="form-input-ems" placeholder="What does this team do?" rows={3}
                value={newDept.description} onChange={(e) => setNewDept({...newDept, description: e.target.value})}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => { setShowDialog(false); setEditingId(null); setNewDept({ name: '', code: '', description: '' }); }}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? (editingId ? 'Updating...' : 'Creating...') : (editingId ? 'Update' : 'Create')}
          </button>
        </DialogActions>

      </Dialog>
    </div>
  );
};

export default Departments;
