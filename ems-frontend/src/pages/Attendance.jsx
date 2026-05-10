import React, { useState } from 'react';
import { Box, Avatar, Chip } from '@mui/material';
import { UserCheck, UserX, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { useAttendanceOverview } from '../hooks/useAttendance';
import { useDepartments } from '../hooks/useDepartments';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../context/AuthContext';

const Attendance = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deptFilter, setDeptFilter] = useState('all');

  const dateStr = currentDate.toLocaleDateString('en-CA');
  
  const { data: attendance = [], isLoading: loadingAttendance } = useAttendanceOverview(dateStr);
  const { data: departments = [] } = useDepartments();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();

  const filtered = attendance.filter(a => deptFilter === 'all' || a.dept === deptFilter);
  const filteredEmployees = employees.filter(e => deptFilter === 'all' || e.departments?.name === deptFilter);

  const adjustDate = (days) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const handleExport = () => {
    if (filtered.length === 0) return;

    // Prepare data for Excel
    const excelData = filtered.map(row => ({
      'Employee Name': row.name,
      'Email': row.email,
      'Department': row.dept,
      'Punch In': row.punchIn,
      'Punch Out': row.punchOut,
      'Status': row.status,
      'Lunch (min)': row.lunchDuration || 0,
      'Actual Work': row.totalHours > 0 ? `${row.totalHours}h` : '--',
      'Overtime': row.overtime > 0 ? `${row.overtime}h` : '--'
    }));

    // Create worksheet
    const worksheet = utils.json_to_sheet(excelData);
    
    // Create workbook
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Attendance');

    // Download file
    const fileName = `Attendance_Log_${dateStr}.xlsx`;
    writeFile(workbook, fileName);
  };

  const baseColumns = [
    {
      field: 'name',
      headerName: 'Employee',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <div className="flex items-center gap-3 h-full">
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 11 }}>
            {params.value.charAt(0)}
          </Avatar>
          <div className="flex flex-col justify-center">
            <span className="text-sm font-semibold">{params.value}</span>
            <span className="text-xs text-slate-500">{params.row.email}</span>
          </div>
        </div>
      )
    },
    { field: 'dept', headerName: 'Department', flex: 1, minWidth: 150 },
    { field: 'punchIn', headerName: 'Punch In', width: 130, align: 'center', headerAlign: 'center' },
    { field: 'punchOut', headerName: 'Punch Out', width: 130, align: 'center', headerAlign: 'center' },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const statusColors = {
          'Present': 'success',
          'Left': 'info',
          'Absent': 'error',
        };
        return (
          <div className="flex items-center justify-center h-full">
            <Chip 
              label={params.value.toUpperCase()} 
              color={statusColors[params.value] || 'default'} 
              size="small" 
              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24 }}
            />
          </div>
        );
      }
    }
  ];

  const isAdmin = ['hr', 'admin', 'super_admin'].includes(profile?.role);
  
  const columns = isAdmin ? [
    ...baseColumns,
    { field: 'lunchDuration', headerName: 'Lunch (min)', width: 120, align: 'center', headerAlign: 'center' },
    { 
      field: 'overtime', 
      headerName: 'Overtime', 
      width: 120, 
      align: 'center', 
      headerAlign: 'center',
      renderCell: (params) => (
        <span className="font-bold text-indigo-500">
          {params.value > 0 ? `${params.value}h` : '--'}
        </span>
      )
    },
    { 
      field: 'totalHours', 
      headerName: 'Actual Work', 
      width: 130, 
      align: 'center', 
      headerAlign: 'center',
      renderCell: (params) => (
        <span className="font-bold text-indigo-600">
          {params.value > 0 ? `${params.value}h` : '--'}
        </span>
      )
    }
  ] : baseColumns;

  // Calculate stats based on total employees vs actual records
  const presentCount = filtered.filter(a => a.status === 'Present' || a.status === 'Left').length;
  const totalEmployeesCount = filteredEmployees.length;
  const absentCount = Math.max(0, totalEmployeesCount - presentCount);
  const attendanceRate = totalEmployeesCount > 0 ? Math.round((presentCount / totalEmployeesCount) * 100) : 0;

  const loadingStats = loadingAttendance || loadingEmployees;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="Attendance" subtitle="Track employee attendance">
        <button className="btn-ems btn-ems-outline" onClick={handleExport}>
          <Download size={16} /> Export Log
        </button>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <StatCard title="Present" value={loadingStats ? '...' : presentCount.toString()} icon={UserCheck} color="#10b981" bgColor="#ecfdf5" />
        <StatCard title="Absent" value={loadingStats ? '...' : absentCount.toString()} icon={UserX} color="#ef4444" bgColor="#fef2f2" />
        <StatCard title="Attendance Rate" value={loadingStats ? '...' : `${attendanceRate}%`} icon={Clock} color="#f59e0b" bgColor="#fffbeb" />
      </div>

      {/* Filters */}
      <Box className="card-ems-static" sx={{ p: 2, mb: 3 }}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button className="btn-icon-ems" aria-label="Previous day" onClick={() => adjustDate(-1)}><ChevronLeft size={16} /></button>
            <span className="font-bold text-sm px-3">{currentDate.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <button className="btn-icon-ems" aria-label="Next day" onClick={() => adjustDate(1)}><ChevronRight size={16} /></button>
          </div>
          <div className="flex gap-2">
            <select className="form-select-ems" style={{ width: 180 }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Box>

      {/* Table */}
      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filtered} 
          loading={loadingAttendance} 
          emptyMessage="No attendance records found for this date."
        />
      </Box>
    </div>
  );
};

export default Attendance;
