import React, { useState, useEffect } from "react";
import { FileText, Download, Plus, Folder, Calendar, Clock, ShieldCheck, MoreVertical, Grid2X2, List, ChevronDown, UploadCloud, Trash2 } from "lucide-react";
import { Box, Chip, Avatar } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { documentService } from '../services/documentService';
import Swal from 'sweetalert2';

const MyDocuments = () => {
  const { user: currentUser } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentService.getUserDocuments(currentUser.id);
      setDocuments(docs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchDocuments();
    }
  }, [currentUser?.id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 7 * 1024 * 1024) {
      Swal.fire('Error', 'File size must be less than 7MB', 'error');
      return;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      Swal.fire('Error', 'Only PDF or Word documents are allowed', 'error');
      return;
    }

    try {
      setUploadingDoc(true);
      await documentService.uploadDocument(currentUser.id, file, {
        category: 'Verification',
        title: file.name,
        uploadedBy: currentUser.id
      });
      Swal.fire('Success', 'Verification document uploaded successfully', 'success');
      fetchDocuments();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setUploadingDoc(false);
      e.target.value = null;
    }
  };

  const handleDownload = async (fileUrl, fileName) => {
    try {
      const url = await documentService.getDownloadUrl(fileUrl);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.click();
    } catch (err) {
      Swal.fire('Error', 'Could not download file', 'error');
    }
  };

  const handleDelete = async (docId, fileUrl) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await documentService.deleteDocument(docId, fileUrl);
        Swal.fire('Deleted!', 'Your file has been deleted.', 'success');
        fetchDocuments();
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  return (
    <div>
      <PageHeader title="My Documents" subtitle="Access and download your personal documents securely">
        <div>
          <input 
            type="file" 
            id="emp-doc-upload" 
            className="hidden" 
            onChange={handleFileUpload} 
            accept=".pdf,.doc,.docx" 
            disabled={uploadingDoc}
          />
          <label htmlFor="emp-doc-upload" className={`btn-ems btn-ems-primary cursor-pointer ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploadingDoc ? 'Uploading...' : <><Plus size={18} /> Upload Verification Doc</>}
          </label>
        </div>
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


        </div>

        {/* Docs List */}
        <div className="p-4 flex flex-col gap-3">
          {loading ? (
            <div className="p-8 text-center text-sm font-bold text-slate-400 animate-pulse">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">No documents found.</p>
            </div>
          ) : documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl transition-all hover:bg-slate-50 hover:border-indigo-100 group">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-16 rounded-xl border flex flex-col items-center justify-center gap-1 flex-shrink-0 ${doc.file_type?.includes('pdf') ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                  <FileText size={24} className={doc.file_type?.includes('pdf') ? 'text-red-500' : 'text-blue-500'} />
                  <span className={`text-[8px] font-black text-white px-1.5 rounded uppercase ${doc.file_type?.includes('pdf') ? 'bg-red-500' : 'bg-blue-500'}`}>
                    {doc.file_type?.includes('pdf') ? 'PDF' : 'DOC'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{doc.title}</h3>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                    <span className="flex items-center gap-1"><Clock size={12} /> {(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">

                <button 
                  onClick={() => handleDownload(doc.file_url, doc.file_name)}
                  className="btn-icon-ems hover:bg-indigo-50 hover:text-indigo-600"
                  title="Download"
                >
                  <Download size={18} />
                </button>
                {doc.uploaded_by === currentUser.id && (
                  <button 
                    onClick={() => handleDelete(doc.id, doc.file_url)}
                    className="btn-icon-ems hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
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