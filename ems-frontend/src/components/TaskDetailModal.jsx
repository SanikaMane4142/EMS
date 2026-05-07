import React, { useState } from "react";
import { 
  X, Calendar, User, Tag, AlertCircle, Clock, CheckSquare, 
  Plus, Trash2, ShieldAlert, Bug, Send, History, ListTodo,
  MoreVertical, CheckCircle2
} from "lucide-react";
import { Modal, Box, IconButton, Chip, Avatar, LinearProgress, Divider } from "@mui/material";

const TaskDetailModal = ({ open, onClose, task, onUpdate }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [newSubtask, setNewSubtask] = useState("");
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [activity, setActivity] = useState(task?.activity || []);

  if (!task) return null;

  const toggleSubtask = (id) => {
    const updated = subtasks.map(st => 
      st.id === id ? { ...st, isCompleted: !st.isCompleted, completedAt: !st.isCompleted ? new Date().toISOString() : null } : st
    );
    setSubtasks(updated);
    
    const st = subtasks.find(s => s.id === id);
    const newAction = {
      id: `act-${Date.now()}`,
      user: "Current User",
      action: `${st.isCompleted ? 'Uncompleted' : 'Completed'} subtask: ${st.title}`,
      date: new Date().toLocaleString()
    };
    setActivity([newAction, ...activity]);
    
    const completedCount = updated.filter(s => s.isCompleted).length;
    const progress = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;
    
    onUpdate({ ...task, subtasks: updated, progress, activity: [newAction, ...activity] });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const st = {
      id: `st-${Date.now()}`,
      title: newSubtask,
      isCompleted: false,
      status: "Pending"
    };
    const updated = [...subtasks, st];
    setSubtasks(updated);
    setNewSubtask("");
    
    const newAction = {
      id: `act-${Date.now()}`,
      user: "Current User",
      action: `Added subtask: ${newSubtask}`,
      date: new Date().toLocaleString()
    };
    setActivity([newAction, ...activity]);
    
    const completedCount = updated.filter(s => s.isCompleted).length;
    const progress = Math.round((completedCount / updated.length) * 100);
    
    onUpdate({ ...task, subtasks: updated, progress, activity: [newAction, ...activity] });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return { bg: '#fee2e2', text: '#ef4444' };
      case 'High': return { bg: '#ffedd5', text: '#f97316' };
      case 'Medium': return { bg: '#eef2ff', text: '#4f46e5' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
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
      <Box className="bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row w-full max-w-5xl max-h-[90vh]">
        
        {/* Left Column - Details (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 border-r border-slate-100 scrollbar-hide">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <Chip 
                label={task.projectName} 
                size="small" 
                sx={{ fontWeight: 800, bgcolor: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5', px: 1 }} 
              />
              <Chip 
                label={task.priority} 
                size="small" 
                sx={{ fontWeight: 800, bgcolor: getPriorityColor(task.priority).bg, color: getPriorityColor(task.priority).text, px: 1 }} 
              />
            </div>
            <IconButton onClick={onClose} size="small" className="bg-slate-50 hover:bg-slate-100 transition-colors">
              <X size={20} />
            </IconButton>
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-8 leading-tight tracking-tight">
            {task.title}
          </h2>

          <div className="flex flex-wrap gap-8 mb-10">
            <div className="flex items-center gap-4">
              <Avatar sx={{ width: 44, height: 44, bgcolor: '#4f46e5', fontWeight: 700, boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)' }}>
                {task.assignedTo.charAt(0)}
              </Avatar>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned To</p>
                <p className="text-base font-bold text-slate-900">{task.assignedTo}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline</p>
                <p className="text-base font-bold text-slate-900">{task.deadline}</p>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4 text-slate-900">
              <AlertCircle size={18} className="text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest">Description</h3>
            </div>
            <div className="bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 leading-relaxed text-slate-600 font-medium">
              {task.description || "No detailed description provided for this task."}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-slate-900">
                <ListTodo size={18} className="text-indigo-600" />
                <h3 className="text-sm font-black uppercase tracking-widest">Subtasks</h3>
              </div>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                {subtasks.filter(s => s.isCompleted).length} / {subtasks.length} Completed
              </span>
            </div>
            
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Overall Progress</span>
                <span className="text-[11px] font-black text-indigo-600">{task.progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-700 ease-out" 
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-[20px] hover:border-indigo-200 hover:shadow-sm transition-all group">
                  <button 
                    onClick={() => toggleSubtask(st.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${st.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-transparent hover:border-indigo-400'}`}
                  >
                    <CheckSquare size={14} />
                  </button>
                  <span className={`text-sm font-bold flex-1 ${st.isCompleted ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                    {st.title}
                  </span>
                  <div className="flex items-center gap-3">
                    {st.isCompleted && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Done</span>}
                    <IconButton size="small" className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative group">
              <Plus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                className="w-full h-14 pl-12 pr-6 bg-slate-50 border border-slate-100 rounded-[20px] text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                placeholder="Add a new subtask..." 
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Activity & Notes */}
        <div className="w-full md:w-[360px] bg-slate-50/80 flex flex-col h-full">
          <div className="p-2 flex bg-white border-b border-slate-100">
            {["activity", "notes"].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all rounded-xl ${activeTab === tab ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === "activity" ? (
              <div className="space-y-8">
                {activity.map((act, i) => (
                  <div key={act.id} className="relative pl-7">
                    {i !== activity.length - 1 && <div className="absolute left-[3px] top-6 bottom-[-32px] w-0.5 bg-slate-200"></div>}
                    <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50"></div>
                    <p className="text-xs font-bold text-slate-800 mb-2 leading-snug">{act.action}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{act.user}</span>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">• {act.date}</span>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="text-center py-20 flex flex-col items-center gap-4 opacity-30">
                    <History size={48} className="text-slate-400" />
                    <p className="text-xs font-black uppercase tracking-widest">No activity log</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
                  <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ShieldAlert size={14} /> Blocker Note
                  </h4>
                  <p className="text-xs text-slate-600 font-bold italic leading-relaxed">
                    "Need the final API documentation before I can finish the auth state logic."
                  </p>
                </div>
                <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
                  <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Bug size={14} /> Bug Report
                  </h4>
                  <p className="text-xs text-slate-600 font-bold italic leading-relaxed">
                    "Sidebar collapses unexpectedly on iPad Mini resolution."
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <textarea 
                    className="w-full bg-white border border-slate-200 rounded-[20px] p-5 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none mb-4"
                    placeholder="Add a comment or log a blocker..."
                    rows={5}
                  />
                  <button className="btn-ems btn-ems-primary w-full h-14 rounded-[20px] shadow-lg shadow-indigo-100">
                    <Send size={18} /> Post Update
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Box>
    </Modal>
  );
};

export default TaskDetailModal;
