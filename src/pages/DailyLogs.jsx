import React, { useState, useEffect } from "react";
import {
  Send, Save, FileText, CheckCircle2, Clock, Target,
  ShieldAlert, Calendar, ChevronDown, ListTodo, Plus,
  Trash2, ChevronRight, Edit3, TrendingUp, Flame, CheckSquare
} from "lucide-react";
import { Box, Chip, Avatar } from '@mui/material';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

const DailyLogs = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tasks, setTasks] = useState([""]);
  const [productivity, setProductivity] = useState("Medium");
  const [lastSaved, setLastSaved] = useState("");

  // Simulated auto-fill from Task Management
  useEffect(() => {
    // In a real app, we'd query the DB for subtasks completed today by this user
    // For prototype, we'll just mock it
    const autoFilledTasks = [
      "Completed design for mobile layout (EMS Modernization)",
      "Fixed MFA verification timeout bug (Security Audit)",
    ];
    setTasks(autoFilledTasks);
  }, []);

  useEffect(() => {
    setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1000);
  };

  const addTask = () => setTasks([...tasks, ""]);
  const removeTask = (index) => setTasks(tasks.filter((_, i) => i !== index));
  const updateTask = (value, index) => {
    const updated = [...tasks];
    updated[index] = value;
    setTasks(updated);
  };

  return (
    <div>
      <PageHeader title="Daily Work Log" subtitle="Summarize your progress, completed tasks, and outcomes">
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
          <Clock size={12} /> Auto-saved at {lastSaved}
        </span>
        <Chip icon={<Calendar size={14} />} label="Apr 28, 2026" variant="outlined" size="small" sx={{ fontWeight: 700 }} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-3">
          <Box className="card-ems-static" sx={{ p: 4 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" /> Today's Log
              </h2>
              {submitted && (
                <Chip label="Submitted" color="success" size="small" icon={<CheckCircle2 size={14} />} sx={{ fontWeight: 700 }} />
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">WORK DONE TODAY *</label>
                <textarea
                  className="form-input-ems"
                  placeholder="What did you achieve today?"
                  required
                  disabled={submitted}
                  rows={4}
                />
                <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-400">
                  <span>Briefly explain your key contributions and output.</span>
                  <span>0 / 500</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">TASKS COMPLETED</label>
                  {!submitted && (
                    <button type="button" className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline" onClick={addTask}>
                      <Plus size={14} /> Add Task
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {tasks.map((task, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="relative flex-1">
                        <ListTodo size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          className="form-input-ems pl-9"
                          value={task}
                          onChange={(e) => updateTask(e.target.value, index)}
                          placeholder="Enter task details..."
                          disabled={submitted}
                        />
                      </div>
                      {tasks.length > 1 && !submitted && (
                        <button type="button" onClick={() => removeTask(index)} className="btn-icon-ems text-red-500 border-red-100 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">TASK TYPE</label>
                  <select className="form-select-ems" disabled={submitted}>
                    <option>Feature</option><option>Bug Fix</option><option>Research</option><option>Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">TIME SPENT (HOURS)</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="number" step="0.5" className="form-input-ems pl-9" placeholder="0.0" disabled={submitted} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">PRODUCTIVITY</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl h-10">
                    {["Low", "Medium", "High"].map(level => (
                      <button
                        key={level} type="button" onClick={() => setProductivity(level)}
                        className={`flex-1 text-xs font-bold rounded-lg transition-all ${productivity === level ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        disabled={submitted}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">BLOCKERS (OPTIONAL)</label>
                  <div className="relative">
                    <ShieldAlert size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="form-input-ems pl-9" placeholder="Anything blocking you?" disabled={submitted} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">PLAN FOR TOMORROW *</label>
                  <div className="relative">
                    <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="form-input-ems pl-9" placeholder="What's the plan?" required disabled={submitted} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4 pt-6 border-t border-slate-100">
                {!submitted ? (
                  <>
                    <button type="submit" className="btn-ems btn-ems-primary flex-1 h-12" disabled={isSubmitting}>
                      <Send size={18} /> {isSubmitting ? 'Submitting...' : 'Submit Work Log'}
                    </button>
                    <button type="button" className="btn-ems btn-ems-secondary h-12 px-8">
                      <Save size={18} /> Save Draft
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn-ems btn-ems-outline w-full h-12" onClick={() => setSubmitted(false)}>
                    <Edit3 size={18} /> Edit Submission
                  </button>
                )}
              </div>
            </form>
          </Box>
        </div>

        {/* Sidebar Summary */}
        <div className="flex flex-col gap-4">
          <StatCard title="Hours Logged" value="0.0h" icon={Clock} color="#4f46e5" bgColor="#eef2ff" />
          <StatCard title="Tasks Added" value={tasks.filter(Boolean).length.toString()} icon={CheckSquare} color="#10b981" bgColor="#ecfdf5" />
          <StatCard title="Productivity" value={productivity} icon={TrendingUp} color="#8b5cf6" bgColor="#f5f3ff" />
          <StatCard title="Streak" value="3 days" icon={Flame} color="#f97316" bgColor="#fff7ed" />
        </div>
      </div>

      {/* Recent Activity */}
      <section className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" /> Recent Activity
          </h2>
          <button className="text-sm font-bold text-indigo-600 hover:underline">View All Logs</button>
        </div>

        {pastLogs.map(log => (
          <Box key={log.id} className="card-ems" sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
            <div className="w-14 h-16 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-700">
              <strong className="text-xl leading-none">{log.date}</strong>
              <span className="text-[10px] font-extrabold uppercase">{log.month}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 mb-1">{log.title}</h3>
              <div className="flex items-center gap-3">
                <span className="badge-pill primary !py-0.5 !px-2 !text-[10px]">{log.type}</span>
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Clock size={12} /> {log.time}h spent
                </span>
                <span className="text-xs font-bold text-emerald-600">Approved</span>
              </div>
            </div>
            <button className="btn-icon-ems"><ChevronDown size={18} /></button>
          </Box>
        ))}
      </section>
    </div>
  );
};

export default DailyLogs;