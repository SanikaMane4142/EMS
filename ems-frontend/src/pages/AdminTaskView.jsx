import React, { useState } from "react";
import { 
  Users, Briefcase, Filter, Search, Download, 
  ChevronRight, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import { Box, Chip, Avatar, Tooltip } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { MOCK_TASKS, MOCK_EMPLOYEES } from '../utils/mockTasks';

const AdminTaskView = () => {
  const [tasks] = useState(MOCK_TASKS);
  const [filterDept, setFilterDept] = useState("All");

  const depts = ["All", "Engineering", "HR", "Management", "Marketing"];

  return (
    <div className="pb-10">
      <PageHeader title="Organization Tasks" subtitle="Monitor productivity and task completion across all departments.">
        <button className="btn-ems btn-ems-outline">
          <Download size={18} /> Export Report
        </button>
      </PageHeader>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Tasks", value: tasks.length, icon: Briefcase, color: "indigo" },
          { label: "In Progress", value: tasks.filter(t => t.status === "In Progress").length, icon: Clock, color: "blue" },
          { label: "Completed Today", value: "8", icon: CheckCircle2, color: "emerald" },
          { label: "Overdue", value: "2", icon: AlertCircle, color: "red" },
        ].map((stat, i) => (
          <Box key={i} className="card-ems-static p-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center`}>
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
          <Box className="card-ems-static p-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={16} className="text-indigo-600" /> Filters
            </h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Department</label>
                <select className="form-select-ems text-xs font-bold" onChange={(e) => setFilterDept(e.target.value)}>
                  {depts.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Priority</label>
                <div className="flex flex-col gap-2">
                  {["Critical", "High", "Medium", "Low"].map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Box>

          <Box className="card-ems-static p-6 bg-indigo-600 text-white">
            <h3 className="text-sm font-black uppercase tracking-widest mb-2">Team Load</h3>
            <p className="text-xs font-medium text-indigo-100 mb-4">Current task distribution across your team.</p>
            <div className="flex flex-col gap-3">
              {MOCK_EMPLOYEES.map(emp => (
                <div key={emp.id}>
                  <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                    <span>{emp.full_name}</span>
                    <span>3 Tasks</span>
                  </div>
                  <div className="w-full h-1 bg-indigo-400/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white w-[70%]"></div>
                  </div>
                </div>
              ))}
            </div>
          </Box>
        </div>

        {/* Right Column - Task Table */}
        <div className="flex-1">
          <Box className="card-ems-static overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="form-input-ems pl-10 h-10 text-xs" placeholder="Search by name, project..." />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Deadline</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: '#4f46e5' }}>{task.assignedTo.charAt(0)}</Avatar>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{task.assignedTo}</p>
                            <p className="text-[10px] font-bold text-slate-400">ID: EMP-001</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900">{task.title}</p>
                        <p className="text-[10px] font-bold text-indigo-600">{task.projectName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600">Engineering</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold ${new Date(task.deadline) < new Date() ? 'text-red-500' : 'text-slate-500'}`}>
                          {task.deadline}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${task.progress}%` }}></div>
                          </div>
                          <span className="text-[10px] font-black text-slate-600">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Chip 
                          label={task.status} 
                          size="small" 
                          sx={{ 
                            height: 18, fontSize: '9px', fontWeight: 800,
                            bgcolor: task.status === 'Done' ? '#ecfdf5' : '#eef2ff',
                            color: task.status === 'Done' ? '#10b981' : '#4f46e5'
                          }} 
                        />
                      </td>
                    </tr>
                  ))}
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
