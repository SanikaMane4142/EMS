import React, { useState, useMemo } from "react";
import { 
  Users, Briefcase, Filter, Search, Download, 
  AlertCircle, CheckCircle2, Clock, ThumbsUp
} from "lucide-react";
import { Box, Chip, Avatar, Skeleton } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { useAllTasks } from '../hooks/useTasks';
import { useEmployees } from '../hooks/useEmployees';
import { taskService } from '../services/taskService';
import { normalizeTask, TASK_STATUS_STYLES } from '../utils/taskUtils';

const AdminTaskView = () => {
  const [filterDept, setFilterDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Real Data Hooks ──
  const { data: rawTasks = [], isLoading: tasksLoading } = useAllTasks();
  const { data: employees = [], isLoading: empsLoading } = useEmployees();

  // ── Normalization ──
  const tasks = useMemo(() => rawTasks.map(normalizeTask), [rawTasks]);
  
  // ── Stats Calculation ──
  const stats = useMemo(() => taskService.computeStats(tasks), [tasks]);

  // ── Derived Data ──
  const depts = useMemo(() => {
    const d = new Set(["All"]);
    employees.forEach(emp => {
      if (emp.departments?.name) d.add(emp.departments.name);
    });
    return Array.from(d);
  }, [employees]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchDept = filterDept === "All" || t.departmentName === filterDept;
      const matchSearch = t.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.project_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [tasks, filterDept, searchQuery]);

  // ── Team Load Calculation ──
  const teamLoad = useMemo(() => {
    return employees.slice(0, 5).map(emp => {
      const empTasks = tasks.filter(t => t.assigned_to === emp.id && t.status !== 'done');
      return {
        id: emp.id,
        name: emp.full_name,
        count: empTasks.length,
        percentage: Math.min((empTasks.length / 5) * 100, 100) // Rough indicator
      };
    });
  }, [employees, tasks]);

  if (tasksLoading || empsLoading) {
    return (
      <div className="pb-10 p-6">
        <Skeleton variant="text" width="300px" height={60} sx={{ mb: 4 }} />
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[1,2,3,4].map(i => <Skeleton key={i} variant="rounded" height={100} sx={{ borderRadius: 4 }} />)}
        </div>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Organization Tasks" subtitle="Monitor productivity and task completion across all departments.">
        <button className="btn-ems btn-ems-outline" onClick={() => window.print()}>
          <Download size={18} /> Export View
        </button>
      </PageHeader>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Tasks", value: stats.total, icon: Briefcase, color: "indigo" },
          { label: "In Progress", value: stats.inProgress, icon: Clock, color: "blue" },
          { label: "In Review", value: stats.inReview, icon: ThumbsUp, color: "amber" },
          { label: "Overdue", value: stats.overdue, icon: AlertCircle, color: "red" },
        ].map((stat, i) => (
          <Box key={i} className="card-ems-static p-6 flex items-center gap-4 border border-slate-100">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
              stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
              stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
              'bg-red-50 text-red-600'
            }`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
            </div>
          </Box>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column - Filters */}
        <div className="w-full md:w-64 flex flex-col gap-6">
          <Box className="card-ems-static p-6 border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={16} className="text-indigo-600" /> Filters
            </h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Department</label>
                <select 
                  className="form-select-ems text-xs font-bold" 
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </Box>

          <Box className="card-ems-static p-6 bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <h3 className="text-sm font-black uppercase tracking-widest mb-2">Active Load</h3>
            <p className="text-xs font-medium text-indigo-100 mb-4">Pending tasks per employee.</p>
            <div className="flex flex-col gap-4">
              {teamLoad.map(emp => (
                <div key={emp.id}>
                  <div className="flex justify-between text-[10px] font-black uppercase mb-1.5">
                    <span className="truncate pr-2">{emp.name}</span>
                    <span className="whitespace-nowrap">{emp.count} Tasks</span>
                  </div>
                  <div className="w-full h-1 bg-indigo-400/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-1000" style={{ width: `${emp.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </Box>
        </div>

        {/* Right Column - Task Table */}
        <div className="flex-1">
          <Box className="card-ems-static overflow-hidden border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  className="form-input-ems pl-10 h-10 text-xs" 
                  placeholder="Search tasks, people or projects..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Showing {filteredTasks.length} tasks
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Assignee</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Task & Project</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Deadline</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <Briefcase size={40} />
                          <p className="text-xs font-bold uppercase tracking-widest">No tasks found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map(task => (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar sx={{ 
                              width: 32, height: 32, 
                              fontSize: 10, fontWeight: 800,
                              bgcolor: 'var(--primary-light)',
                              color: 'var(--primary)'
                            }}>
                              {task.assigneeAvatar}
                            </Avatar>
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-tight">{task.assignedToName}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Emp-ID: {task.assignee?.employee_id || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-900 leading-tight">{task.title}</p>
                          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{task.project_name || 'Personal'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded-full uppercase tracking-tighter">
                            {task.departmentName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold ${
                              task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done' 
                                ? 'text-red-500' : 'text-slate-600'
                            }`}>
                              {task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No deadline'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${task.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-700">{task.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const config = TASK_STATUS_STYLES[task.status] || { label: task.status, color: 'slate' };
                            const colorMap = {
                              indigo: { bg: '#eef2ff', text: '#4f46e5' },
                              emerald: { bg: '#ecfdf5', text: '#10b981' },
                              amber: { bg: '#fffbeb', text: '#d97706' },
                              slate: { bg: '#f8fafc', text: '#64748b' }
                            };
                            const styles = colorMap[config.color] || colorMap.slate;
                            return (
                              <Chip 
                                label={config.label} 
                                size="small" 
                                sx={{ 
                                  height: 20, fontSize: '9px', fontWeight: 800,
                                  bgcolor: styles.bg,
                                  color: styles.text,
                                  border: `1px solid ${styles.text}15`,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }} 
                              />
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default AdminTaskView;
