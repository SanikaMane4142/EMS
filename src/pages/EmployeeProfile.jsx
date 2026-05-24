import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Avatar, Tab, Tabs, Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { User as UserIcon, Mail, Briefcase, MapPin, Calendar, Clock, FileText, ChevronLeft, Shield, Phone, MoreVertical, X, Save, Download, UploadCloud, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import RoleBadge from '../components/RoleBadge';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

import { profileService } from '../services/profileService';
import { attendanceService } from '../services/attendanceService';
import { leaveService } from '../services/leaveService';
import { documentService } from '../services/documentService';
const EmployeeProfile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({});
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const isHR = ['hr', 'admin', 'super_admin'].includes(currentProfile?.role);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prof, att, leaves, docs] = await Promise.all([
        profileService.getProfileById(id),
        attendanceService.getAttendanceHistory(id),
        leaveService.getMyLeaves(id),
        documentService.getUserDocuments(id)
      ]);
      setEmployee(prof);
      setAttendanceHistory(att || []);
      setLeaveHistory(leaves || []);
      setDocuments(docs || []);
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [id]);

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
      await documentService.uploadDocument(id, file, {
        category: 'Joining',
        title: file.name,
        uploadedBy: currentUser.id
      });
      Swal.fire('Success', 'Document uploaded successfully', 'success');
      const updatedDocs = await documentService.getUserDocuments(id);
      setDocuments(updatedDocs);
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
        const updatedDocs = await documentService.getUserDocuments(id);
        setDocuments(updatedDocs);
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Loading Profile...</div>;
  if (!employee) return <div className="p-10 text-center font-bold text-slate-500">Employee not found.</div>;

  return (
    <div>
      <PageHeader title="Employee Profile" subtitle={`Viewing details for ${employee.full_name || employee.email}`} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Profile Card */}
        <div className="lg:col-span-1">
          <Box className="card-ems-static" sx={{ p: 4, textAlign: 'center' }}>
            <Avatar sx={{ width: 100, height: 100, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 800, fontSize: 32, mx: 'auto', mb: 2.5, borderRadius: '24px' }}>
              {(employee.full_name || employee.email).charAt(0).toUpperCase()}
            </Avatar>
            <h2 className="text-xl font-black text-slate-900 mb-1">{employee.full_name || 'No Name'}</h2>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{employee.designation || 'Employee'}</p>
            <RoleBadge role={employee.role} size="medium" />

            <div className="mt-8 flex flex-col gap-3 text-left">
              {[
                { icon: Briefcase, label: 'Department', value: employee.departments?.name || 'Unassigned' },
                { icon: Mail, label: 'Email', value: employee.email },
                { icon: Calendar, label: 'Official Joining', value: employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : 'N/A' },
                { icon: Clock, label: 'Portal Joined', value: employee.joined_at ? new Date(employee.joined_at).toLocaleDateString() : 'N/A' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <item.icon size={16} className="text-indigo-600" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-xs font-bold text-slate-700">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Box>
        </div>

        {/* Right: Detailed Info Tabs */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <button className="btn-ems btn-ems-secondary" onClick={() => navigate(-1)}>
              <ChevronLeft size={16} /> Back
            </button>
            {(isHR || currentUser?.id === id) && (
              <button className="btn-ems btn-ems-primary" onClick={() => {
                setEditData({ ...employee });
                setShowEdit(true);
              }}>
                Edit Profile
              </button>
            )}
          </div>
          <Box className="card-ems-static" sx={{ height: '100%', overflow: 'hidden' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
                <Tab label="Overview" sx={{ fontWeight: 700, textTransform: 'none' }} />
                <Tab label="Attendance" sx={{ fontWeight: 700, textTransform: 'none' }} />
                <Tab label="Leaves" sx={{ fontWeight: 700, textTransform: 'none' }} />
                <Tab label="Documents" sx={{ fontWeight: 700, textTransform: 'none' }} />
              </Tabs>
            </Box>

            <div className="p-6">
              {activeTab === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Contact Information</h3>
                    <div className="flex flex-col gap-4">
                      <div><p className="text-xs font-bold text-slate-400">Phone</p><p className="text-sm font-bold text-slate-900">{employee.phone || 'N/A'}</p></div>
                      <div><p className="text-xs font-bold text-slate-400">Status</p><p className="text-sm font-bold text-slate-900 uppercase tracking-widest text-indigo-600">{employee.status}</p></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Work Details</h3>
                    <div className="flex flex-col gap-4">
                      <div><p className="text-xs font-bold text-slate-400">Contract Type</p><p className="text-sm font-bold text-slate-900">Full-Time</p></div>

                    </div>
                  </div>
                </div>
              )}

              {activeTab === 1 && (
                <div className="table-responsive">
                  <table className="table-ems" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Punch In</th>
                        <th>Punch Out</th>
                        <th style={{ textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((row, i) => (
                        <tr key={i}>
                          <td className="text-sm font-bold text-slate-700">{row.attendance_date}</td>
                          <td className="text-sm text-slate-600">
                            {row.punch_in_time ? new Date(row.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="text-sm text-slate-600">
                            {row.punch_out_time ? new Date(row.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`badge-pill ${row.status === 'punched_in' ? 'success' : 'neutral'}`}>
                              {row.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 2 && (
                <div className="table-responsive">
                  <table className="table-ems" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Duration</th>
                        <th>Reason</th>
                        <th style={{ textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveHistory.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>No leaves found</td></tr>
                      ) : leaveHistory.map((row, i) => (
                        <tr key={i}>
                          <td className="text-sm font-bold text-slate-700">{row.leave_type}</td>
                          <td className="text-sm text-slate-600">{new Date(row.start_date).toLocaleDateString()} to {new Date(row.end_date).toLocaleDateString()}</td>
                          <td className="text-sm text-slate-600 truncate max-w-[200px]">{row.reason}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`badge-pill ${row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}`}>
                              {row.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 3 && (
                <div>
                  {isHR && (
                    <div className="flex justify-end mb-4">
                      <input 
                        type="file" 
                        id="hr-doc-upload" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                        accept=".pdf,.doc,.docx" 
                        disabled={uploadingDoc}
                      />
                      <label htmlFor="hr-doc-upload" className={`btn-ems btn-ems-primary cursor-pointer ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploadingDoc ? 'Uploading...' : <><UploadCloud size={16} /> Upload Joining Document</>}
                      </label>
                    </div>
                  )}

                  {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                      <FileText size={48} className="mb-4 opacity-20" />
                      <p className="text-sm font-bold">No documents found.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center text-indigo-600 shrink-0">
                              <FileText size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{doc.title}</h3>
                              <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                                <span>{doc.file_type?.includes('pdf') ? 'PDF' : 'DOC'}</span>
                                <span>•</span>
                                <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                <span>•</span>
                                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
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
                  )}
                </div>
              )}
            </div>
          </Box>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onClose={() => setShowEdit(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Edit Profile
          <IconButton onClick={() => setShowEdit(false)}><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
              <input 
                type="text" className="form-input-ems" 
                value={editData.full_name || ''} 
                onChange={(e) => setEditData({...editData, full_name: e.target.value})}
              />
            </div>
            
            {/* JOINING DATE & JOINED AT - RESTRICTED TO HR/ADMIN */}
            {isHR ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-2">
                    Official Joining <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-wider">HR</span>
                  </label>
                  <input 
                    type="date" className="form-input-ems" 
                    value={editData.joining_date || ''} 
                    onChange={(e) => setEditData({...editData, joining_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-2">
                    Portal Joined <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">HR</span>
                  </label>
                  <input 
                    type="date" className="form-input-ems" 
                    value={editData.joined_at || ''} 
                    onChange={(e) => setEditData({...editData, joined_at: e.target.value})}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Official Joining</p>
                  <p className="text-xs text-slate-500 italic">HR Only</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Portal Joined</p>
                  <p className="text-xs text-slate-500 italic">HR Only</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button className="btn-ems btn-ems-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn-ems btn-ems-primary" onClick={async () => {
            try {
              setLoading(true);
              const { departments, id: _, ...cleanData } = editData;
              await profileService.updateProfile(id, cleanData);
              Swal.fire('Success', 'Profile updated successfully!', 'success');
              setShowEdit(false);
              await fetchData();
            } catch (err) {
              Swal.fire('Error', err.message, 'error');
            } finally {
              setLoading(false);
            }
          }}>
            <Save size={16} /> Save Changes
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default EmployeeProfile;
