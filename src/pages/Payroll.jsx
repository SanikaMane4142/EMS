import React, { useState } from 'react';
import { Box, Avatar } from '@mui/material';
import { DollarSign, Download, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

const Payroll = () => {
  const [selectedMonth, setSelectedMonth] = useState('April 2026');

  const payrollData = [
    { id: 1, name: 'David Chen', dept: 'AIML', gross: 8500, deductions: 1250, net: 7250, status: 'Paid' },
    { id: 2, name: 'Emma Wilson', dept: 'UI/UX', gross: 7200, deductions: 1080, net: 6120, status: 'Paid' },
    { id: 3, name: 'James Miller', dept: 'Full Stack', gross: 6800, deductions: 980, net: 5820, status: 'Pending' },
    { id: 4, name: 'Sarah Wilson', dept: 'Android', gross: 7000, deductions: 1050, net: 5950, status: 'Paid' },
    { id: 5, name: 'Raj Kumar', dept: 'AIML', gross: 6500, deductions: 920, net: 5580, status: 'Processing' },
    { id: 6, name: 'Lisa Chen', dept: 'UI/UX', gross: 5800, deductions: 850, net: 4950, status: 'Paid' },
  ];

  const totalGross = payrollData.reduce((a, p) => a + p.gross, 0);
  const totalDeductions = payrollData.reduce((a, p) => a + p.deductions, 0);
  const totalNet = payrollData.reduce((a, p) => a + p.net, 0);

  const formatCurrency = (val) => `$${val.toLocaleString()}`;

  const columns = [
    {
      field: 'name',
      headerName: 'Employee',
      flex: 1.5,
      minWidth: 200,
      renderCell: (params) => {
        const row = params.row;
        return (
          <div className="flex items-center gap-3 w-full h-full">
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 11 }}>
              {row.name.charAt(0)}
            </Avatar>
            <span className="text-sm font-semibold text-slate-900">{row.name}</span>
          </div>
        );
      }
    },
    {
      field: 'dept',
      headerName: 'Department',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => <span className="text-sm text-slate-500">{params.value}</span>
    },
    {
      field: 'gross',
      headerName: 'Gross Pay',
      flex: 1,
      minWidth: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => <span className="text-sm font-semibold text-slate-900">{formatCurrency(params.value)}</span>
    },
    {
      field: 'deductions',
      headerName: 'Deductions',
      flex: 1,
      minWidth: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => <span className="text-sm text-red-500 font-medium">-{formatCurrency(params.value)}</span>
    },
    {
      field: 'net',
      headerName: 'Net Pay',
      flex: 1,
      minWidth: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => <span className="text-sm font-bold text-emerald-600">{formatCurrency(params.value)}</span>
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = params.value;
        return (
          <span className={`badge-pill ${status === 'Paid' ? 'success' : status === 'Processing' ? 'info' : 'warning'}`}>
            {status}
          </span>
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Payslip',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (params) => (
        <div className="flex items-center justify-end h-full w-full">
          <button className="btn-icon-ems" style={{ width: 32, height: 32 }} aria-label={`Download payslip for ${params.row.name}`}>
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="Payroll" subtitle="Monthly payroll management — Restricted access">
        <button className="btn-ems btn-ems-outline">
          <Calendar size={16} /> Change Period
        </button>
        <button className="btn-ems btn-ems-primary">
          <Download size={16} /> Export Payroll
        </button>
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <StatCard title="Total Gross" value={formatCurrency(totalGross)} icon={DollarSign} color="#4f46e5" bgColor="#eef2ff" />
        <StatCard title="Total Deductions" value={formatCurrency(totalDeductions)} icon={FileText} color="#ef4444" bgColor="#fef2f2" />
        <StatCard title="Total Net Pay" value={formatCurrency(totalNet)} icon={DollarSign} color="#10b981" bgColor="#ecfdf5" />
      </div>

      {/* Month Nav */}
      <Box className="card-ems-static" sx={{ p: 2, mb: 3 }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button className="btn-icon-ems" aria-label="Previous month"><ChevronLeft size={16} /></button>
            <span className="font-bold text-sm px-3">{selectedMonth}</span>
            <button className="btn-icon-ems" aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="flex gap-2">
            <select className="form-select-ems" style={{ width: 160 }}>
              <option>All Departments</option>
              <option>AIML</option><option>UI/UX</option><option>Full Stack</option>
            </select>
            <select className="form-select-ems" style={{ width: 130 }}>
              <option>All Status</option>
              <option>Paid</option><option>Pending</option><option>Processing</option>
            </select>
          </div>
        </div>
      </Box>

      {/* Payroll Table */}
      <DataTable 
        columns={columns} 
        data={payrollData} 
        emptyMessage="No payroll records for this period."
      />
    </div>
  );
};

export default Payroll;
