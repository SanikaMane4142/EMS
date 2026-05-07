import React, { useState } from "react";
import { X, Calendar, User, Tag, AlertCircle, Type, FileText } from "lucide-react";
import { Modal, Box, IconButton, Chip } from "@mui/material";
import { MOCK_PROJECTS, MOCK_EMPLOYEES } from "../utils/mockTasks";

const CreateTaskModal = ({ open, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    title: "",
    projectName: MOCK_PROJECTS[0],
    assignedTo: MOCK_EMPLOYEES[0].full_name,
    deadline: "",
    priority: "Medium",
    description: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({
      ...formData,
      id: `task-${Date.now()}`,
      status: "Pending",
      progress: 0,
      createdAt: new Date().toISOString().split('T')[0],
      subtasks: [],
      activity: [{ id: `act-${Date.now()}`, user: "Admin", action: "Created task", date: new Date().toLocaleString() }]
    });
    onClose();
  };

  return (
    <Modal 
      open={open} 
      onClose={onClose}
      disablePortal
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        p: 2,
        zIndex: 9999
      }}
    >
      <Box className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-xl max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-900">Create New Task</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Assign work to your team</p>
          </div>
          <IconButton onClick={onClose} size="small" className="bg-white shadow-sm border border-slate-100">
            <X size={20} />
          </IconButton>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Task Title</label>
            <div className="relative">
              <Type size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                required
                className="form-input-ems pl-10" 
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Project</label>
              <div className="relative">
                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  className="form-select-ems pl-10"
                  value={formData.projectName}
                  onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                >
                  {MOCK_PROJECTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Assign To</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  className="form-select-ems pl-10"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                >
                  {MOCK_EMPLOYEES.map(e => <option key={e.id}>{e.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Deadline</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date" 
                  required
                  className="form-input-ems pl-10"
                  value={formData.deadline}
                  onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Priority</label>
              <div className="relative">
                <AlertCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  className="form-select-ems pl-10"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description</label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-4 text-slate-400" />
              <textarea 
                className="form-input-ems pl-10 py-3" 
                rows={4} 
                placeholder="Provide more details about this task..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>
        </form>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="btn-ems btn-ems-secondary flex-1 h-12">Cancel</button>
          <button onClick={handleSubmit} className="btn-ems btn-ems-primary flex-1 h-12 shadow-lg shadow-indigo-200">Create Task</button>
        </div>
      </Box>
    </Modal>
  );
};

export default CreateTaskModal;
