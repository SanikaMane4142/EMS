import React, { useState } from 'react';
import { Box, Avatar } from '@mui/material';
import { DollarSign, Download, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';

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

  return (
    <div>
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
      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table-ems" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th style={{ textAlign: 'right' }}>Gross Pay</th>
                <th style={{ textAlign: 'right' }}>Deductions</th>
                <th style={{ textAlign: 'right' }}>Net Pay</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 11 }}>
                        {row.name.charAt(0)}
                      </Avatar>
                      <span className="text-sm font-semibold text-slate-900">{row.name}</span>
                    </div>
                  </td>
                  <td className="text-sm text-slate-500">{row.dept}</td>
                  <td className="text-sm font-semibold text-slate-900" style={{ textAlign: 'right' }}>{formatCurrency(row.gross)}</td>
                  <td className="text-sm text-red-500 font-medium" style={{ textAlign: 'right' }}>-{formatCurrency(row.deductions)}</td>
                  <td className="text-sm font-bold text-emerald-600" style={{ textAlign: 'right' }}>{formatCurrency(row.net)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge-pill ${row.status === 'Paid' ? 'success' : row.status === 'Processing' ? 'info' : 'warning'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-icon-ems" style={{ width: 32, height: 32 }} aria-label={`Download payslip for ${row.name}`}>
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                <td colSpan={2} className="text-sm font-bold text-slate-900" style={{ padding: '16px' }}>Totals</td>
                <td className="text-sm font-bold text-slate-900" style={{ textAlign: 'right', padding: '16px' }}>{formatCurrency(totalGross)}</td>
                <td className="text-sm font-bold text-red-500" style={{ textAlign: 'right', padding: '16px' }}>-{formatCurrency(totalDeductions)}</td>
                <td className="text-sm font-extrabold text-emerald-600" style={{ textAlign: 'right', padding: '16px' }}>{formatCurrency(totalNet)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Box>
    </div>
  );
};

export default Payroll;
