import React, { useState, useRef, useMemo, useEffect } from "react";
import { 
  X, Calendar, User, Tag, AlertCircle, Type, FileText, 
  Loader2, Plus, Trash2, CheckCircle2, ChevronRight, 
  Search, UserPlus, Users, Sparkles, Flag, ArrowLeft,
  Layout
} from "lucide-react";
import { 
  Modal, Box, IconButton, Avatar, CircularProgress, 
  Tooltip, Zoom, Fade, Badge 
} from "@mui/material";
import { useEmployees } from "../hooks/useEmployees";
import { useAuth } from "../context/AuthContext";

const PRIORITY_OPTS = [
  { label: "Low", color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", icon: Flag },
  { label: "Medium", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", icon: Flag },
  { label: "High", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", icon: Flag },
  { label: "Critical", color: "text-red-600", bg: "bg-red-50", border: "border-red-100", icon: AlertCircle }
];

const CreateTaskModal = ({ open, onClose, onCreate, initialData = null, isSubmitting = false }) => {
  const { user } = useAuth();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const subtaskInputRef = useRef(null);

  const [step, setStep] = useState(0); // 0: Selection, 1: Form
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    projectName: "",
    assignedTo: [],
    deadline: "",
    priority: "Medium",
    description: "",
    subtasks: []
  });

  // Populate form if initialData is provided
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        projectName: initialData.project_name || "",
        assignedTo: initialData.assigned_to ? [initialData.assigned_to] : [],
        deadline: initialData.deadline || "",
        priority: initialData.priority || "Medium",
        description: initialData.description || "",
        subtasks: [] // Subtasks are handled differently in this app (groups), but we keep this for consistency
      });
      setStep(1); // Go straight to form
    }
  }, [initialData]);

  const [newSubtask, setNewSubtask] = useState("");

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.id !== user?.id && 
      (e.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       e.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [employees, searchQuery, user?.id]);

  const set = (field) => (val) => setFormData((prev) => ({ ...prev, [field]: val }));

  const handleSelectSelf = () => {
    set("assignedTo")([user.id]);
    setStep(1);
  };

  const toggleEmployee = (empId) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(empId)
        ? prev.assignedTo.filter(id => id !== empId)
        : [...prev.assignedTo, empId]
    }));
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, newSubtask.trim()]
    }));
    setNewSubtask("");
    subtaskInputRef.current?.focus();
  };

  const removeSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.assignedTo.length === 0) return;
    onCreate({
      ...formData,
      id: initialData?.id, // Pass ID if editing
      title: formData.title.trim(),
      projectName: formData.projectName.trim() || null,
      description: formData.description.trim() || null,
      assignedBy: initialData?.assigned_by || user.id,
    });
  };

  const handleClose = () => {
    setStep(0);
    setSearchQuery("");
    setFormData({
      title: "",
      projectName: "",
      assignedTo: [],
      deadline: "",
      priority: "Medium",
      description: "",
      subtasks: []
    });
    setNewSubtask("");
    onClose();
  };

  const isSelf = formData.assignedTo.length === 1 && formData.assignedTo[0] === user?.id;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2, zIndex: 9999 }}
      closeAfterTransition
      disablePortal
    >
      <Zoom in={open}>
        <Box className="bg-white rounded-[40px] shadow-2xl overflow-hidden w-full max-w-2xl max-h-[92vh] flex flex-col border border-slate-100">
          
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-slate-50 to-white">
            <div className="flex items-center gap-4">
              {step === 1 && (
                <IconButton 
                  onClick={() => setStep(0)}
                  className="bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
                >
                  <ArrowLeft size={18} className="text-slate-600" />
                </IconButton>
              )}
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {initialData ? "Edit Task" : step === 0 ? "Assignment Mode" : "Task Details"}
                  <Sparkles size={20} className="text-indigo-500 animate-pulse" />
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  {initialData ? "Update your task configurations" : step === 0 ? "Who are you creating this task for?" : "Configure your task requirements"}
                </p>
              </div>
            </div>
            <IconButton onClick={handleClose} className="hover:rotate-90 transition-transform">
              <X size={20} className="text-slate-400" />
            </IconButton>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {step === 0 ? (
              /* STEP 0: SELECTION */
              <div className="p-8 space-y-8 animate-fade-in">
                <div className="grid grid-cols-2 gap-6">
                  {/* Self Card */}
                  <button
                    onClick={handleSelectSelf}
                    className="group relative p-8 rounded-[32px] border-2 border-slate-100 bg-white hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-100 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <User size={80} />
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <UserPlus size={28} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2">Personal Task</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Create a task for yourself. No one else will be notified until completion.
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest">
                      Start Now <ChevronRight size={14} />
                    </div>
                  </button>

                  {/* Team Card */}
                  <div className="group relative p-8 rounded-[32px] border-2 border-slate-100 bg-white hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-100 transition-all text-left overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-purple-600">
                      <Users size={80} />
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                      <Users size={28} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2">Team Delegate</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Assign a task to a teammate. Use the searchable directory below to select the right person.
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-purple-600 font-black text-xs uppercase tracking-widest">
                      Search Directory <ChevronRight size={14} />
                    </div>
                  </div>
                </div>

                {/* Employee Search Picker */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Teammates</h4>
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {employees.length} Members
                    </span>
                  </div>
                  
                  <div className="relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400"
                      placeholder="Search by name or employee ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {loadingEmployees ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <CircularProgress size={32} thickness={5} className="text-indigo-500" />
                        <span className="text-sm font-bold text-slate-400 italic">Syncing Team Directory...</span>
                      </div>
                    ) : filteredEmployees.length > 0 ? (
                      filteredEmployees.map((emp) => {
                        const isSelected = formData.assignedTo.includes(emp.id);
                        return (
                          <button
                            key={emp.id}
                            onClick={() => toggleEmployee(emp.id)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group/emp ${
                              isSelected 
                                ? "border-indigo-500 bg-indigo-50/50 shadow-sm" 
                                : "border-transparent hover:border-indigo-100 hover:bg-indigo-50/50"
                            }`}
                          >
                            <Avatar 
                              src={emp.avatar_url} 
                              sx={{ width: 48, height: 48 }}
                              className={`shadow-sm border-2 transition-all ${isSelected ? "border-indigo-500" : "border-white group-hover/emp:border-indigo-200"}`}
                            >
                              {emp.full_name?.charAt(0)}
                            </Avatar>
                            <div className="flex-1 text-left">
                              <div className={`text-sm font-black transition-colors ${isSelected ? "text-indigo-700" : "text-slate-900 group-hover/emp:text-indigo-600"}`}>
                                {emp.full_name}
                              </div>
                              <div className={`text-[10px] font-bold flex items-center gap-2 ${isSelected ? "text-indigo-500" : "text-slate-400"}`}>
                                {emp.employee_id} • {emp.departments?.name || "Global"}
                              </div>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 size={20} className="text-indigo-600" />
                            ) : (
                              <ChevronRight size={16} className="text-slate-300 group-hover/emp:translate-x-1 group-hover/emp:text-indigo-400 transition-all" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                        <Search size={40} className="text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-400">No matching teammates found</p>
                      </div>
                    )}
                  </div>
                  {formData.assignedTo.length > 0 && !isSelf && (
                    <div className="pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setStep(1)}
                        className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black transition-all tracking-widest text-[10px] uppercase shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                      >
                        Continue with {formData.assignedTo.length} {formData.assignedTo.length === 1 ? 'Teammate' : 'Teammates'}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* STEP 1: FORM */
              <form onSubmit={handleSubmit} className="p-8 space-y-8 animate-fade-in">
                {/* Active Selection Badge */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                    {isSelf ? <User size={20} className="text-indigo-600" /> : <Users size={20} className="text-purple-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Assigned To</p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {isSelf 
                        ? "Myself" 
                        : formData.assignedTo.length > 0 
                          ? formData.assignedTo
                              .map(id => employees.find(e => e.id === id)?.full_name)
                              .filter(Boolean)
                              .join(', ')
                          : "Unassigned"}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setStep(0)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    CHANGE
                  </button>
                </div>

                {/* Section: Details */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Task Definition</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="relative group">
                      <label className="absolute -top-2 left-4 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">Task Title *</label>
                      <Type size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        required
                        className="w-full bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold placeholder:text-slate-300 transition-all outline-none shadow-sm"
                        placeholder="e.g. Implement the dashboard analytics"
                        value={formData.title}
                        onChange={(e) => set("title")(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                        <label className="absolute -top-2 left-4 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">Project / Category</label>
                        <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          className="w-full bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold placeholder:text-slate-300 transition-all outline-none shadow-sm"
                          placeholder="Project Name"
                          value={formData.projectName}
                          onChange={(e) => set("projectName")(e.target.value)}
                        />
                      </div>
                      <div className="relative group">
                        <label className="absolute -top-2 left-4 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">Due Date</label>
                        <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          type="date"
                          className="w-full bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold transition-all outline-none shadow-sm cursor-pointer"
                          value={formData.deadline}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => set("deadline")(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Priority */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Priority Matrix</h3>
                  </div>
                  <div className="flex gap-3">
                    {PRIORITY_OPTS.map((opt) => {
                      const Icon = opt.icon;
                      const active = formData.priority === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => set("priority")(opt.label)}
                          className={`flex-1 py-4 px-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                            active 
                              ? `${opt.bg} ${opt.border} ${opt.color} shadow-lg shadow-${opt.color.split('-')[1]}-100 scale-[1.05]` 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                          }`}
                        >
                          <Icon size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Checklist */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Success Checklist</h3>
                    </div>
                    <Badge badgeContent={formData.subtasks.length} color="primary" className="font-bold" />
                  </div>

                  <div className="space-y-3">
                    {formData.subtasks.map((st, idx) => (
                      <Fade in key={idx}>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl group/item border border-slate-100 shadow-sm">
                          <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-black text-[10px]">
                            {idx + 1}
                          </div>
                          <span className="flex-1 text-sm font-bold text-slate-700">{st}</span>
                          <IconButton 
                            size="small" 
                            onClick={() => removeSubtask(idx)}
                            className="hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover/item:opacity-100"
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      </Fade>
                    ))}

                    <div className="group relative">
                      <Plus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        ref={subtaskInputRef}
                        className="w-full bg-white border-2 border-dashed border-slate-200 focus:border-indigo-500 focus:border-solid focus:bg-white rounded-2xl py-4 pl-12 pr-24 text-sm font-bold text-slate-600 placeholder:text-slate-300 transition-all outline-none"
                        placeholder="Define a success criteria..."
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                      />
                      <button
                        type="button"
                        onClick={addSubtask}
                        disabled={!newSubtask.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-indigo-100 transition-all disabled:opacity-0"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section: Description */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-pink-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Task Context</h3>
                  </div>
                  <div className="relative group">
                    <FileText size={18} className="absolute left-4 top-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <textarea
                      className="w-full bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 transition-all outline-none min-h-[120px] resize-none shadow-sm"
                      placeholder="Add any extra notes, links, or specific requirements here..."
                      value={formData.description}
                      onChange={(e) => set("description")(e.target.value)}
                    />
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          {step === 1 && (
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                onClick={handleClose} 
                className="flex-1 py-4 px-6 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all tracking-widest text-[10px] uppercase border border-slate-200 bg-white shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.title.trim()}
                className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 text-white font-black transition-all tracking-widest text-[10px] uppercase shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>{initialData ? "Update Task" : "Launch Task"}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </Box>
      </Zoom>
    </Modal>
  );
};

export default CreateTaskModal;
