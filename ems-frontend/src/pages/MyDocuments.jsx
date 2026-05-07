import React from "react";
import { FileText, Download, Plus, Folder, Calendar, Clock, ShieldCheck, MoreVertical, Grid2X2, List, ChevronDown } from "lucide-react";
import { Box, Chip, Avatar } from '@mui/material';
import PageHeader from '../components/PageHeader';

const MyDocuments = () => {
  const docs = [
    { name: "Offer_Letter_Jane_Doe.pdf", type: "PDF", size: "1.2 MB", date: "12 Jan, 2024", category: "Employment" },
    { name: "Payslip_March_2026.pdf", type: "PDF", size: "450 KB", date: "01 Apr, 2026", category: "Payslip" },
    { name: "Policy_Manual_2026.pdf", type: "PDF", size: "2.5 MB", date: "05 Jan, 2026", category: "Policy" },
  ];

  return (
    <div>
      <PageHeader title="My Documents" subtitle="Access and download your personal documents securely">
        <button className="btn-ems btn-ems-primary">
          <Plus size={18} /> Upload Document
        </button>
      </PageHeader>

      <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
        {/* Card Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Folder size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Personal Documents</h2>
              <p className="text-xs text-slate-500 font-medium">All your uploaded and shared documents in one place</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-ems btn-ems-secondary !h-10 !text-xs">
              Sort by: Newest <ChevronDown size={14} />
            </button>
            <div className="flex bg-slate-50 p-1 rounded-xl">
              <button className="p-1.5 rounded-lg bg-white text-indigo-600 shadow-sm"><List size={16} /></button>
              <button className="p-1.5 rounded-lg text-slate-400"><Grid2X2 size={16} /></button>
            </div>
          </div>
        </div>

        {/* Docs List */}
        <div className="p-4 flex flex-col gap-3">
          {docs.map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl transition-all hover:bg-slate-50 hover:border-indigo-100 group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-16 rounded-xl bg-red-50 border border-red-100 flex flex-col items-center justify-center gap-1 flex-shrink-0">
                  <FileText size={24} className="text-red-500" />
                  <span className="text-[8px] font-black bg-red-500 text-white px-1.5 rounded uppercase">PDF</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{doc.name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                    <span className="flex items-center gap-1"><FileText size={12} /> {doc.type}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {doc.size}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {doc.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Chip
                  label={doc.category}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: 10,
                    bgcolor: doc.category === 'Employment' ? '#eef2ff' : doc.category === 'Payslip' ? '#eff6ff' : '#ecfdf5',
                    color: doc.category === 'Employment' ? '#4f46e5' : doc.category === 'Payslip' ? '#2563eb' : '#16a34a',
                  }}
                />
                <button className="btn-icon-ems hover:bg-indigo-50 hover:text-indigo-600"><Download size={18} /></button>
                <button className="btn-icon-ems"><MoreVertical size={18} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Secure Banner */}
        <div className="m-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white text-emerald-500 flex items-center justify-center shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Your documents are secure</h3>
              <p className="text-xs text-slate-500">Encrypted and stored with enterprise-grade security</p>
            </div>
          </div>
          <Folder size={40} className="text-slate-200" />
        </div>
      </Box>
    </div>
  );
};

export default MyDocuments;