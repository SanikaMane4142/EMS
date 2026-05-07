import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, Avatar } from '@mui/material';
import { Mail, Phone, MapPin, Calendar, Briefcase, Save } from 'lucide-react';
import RoleBadge from '../components/RoleBadge';
import PageHeader from '../components/PageHeader';
import { profileService } from '../services/profileService';
import Swal from 'sweetalert2';

const MyProfile = () => {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({ full_name: '', phone: '', birthday: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        birthday: profile.birthday ? profile.birthday.split('T')[0] : ''
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await profileService.updateProfile(user.id, formData);
      Swal.fire('Success', 'Profile updated successfully!', 'success');
      // The auth context listener should eventually pick up the change, 
      // but the user will see the success message immediately.
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to update profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const departmentName = profile?.departments?.name || 'Unassigned';
  const joinDate = profile?.joined_at ? new Date(profile.joined_at).toLocaleDateString() : 'N/A';

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader title="My Profile" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Box className="card-ems-static" sx={{ p: 4, textAlign: 'center' }}>
          <Avatar sx={{
            width: 80, height: 80, bgcolor: '#eef2ff', color: '#4f46e5',
            fontWeight: 800, fontSize: 28, mx: 'auto', mb: 2, borderRadius: '20px'
          }}>
            {(formData.full_name || user?.email || 'U').charAt(0).toUpperCase()}
          </Avatar>
          <h2 className="text-lg font-extrabold text-slate-900 mb-1">{formData.full_name || 'User'}</h2>
          <p className="text-sm text-slate-500 mb-3">{user?.email}</p>
          <RoleBadge role={profile?.role} size="medium" />
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3 text-left">
            <div className="flex items-center gap-3 text-sm">
              <Briefcase size={16} className="text-slate-400" />
              <span className="text-slate-600">{departmentName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin size={16} className="text-slate-400" />
              <span className="text-slate-600">Remote — India</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-slate-600">Joined {joinDate}</span>
            </div>
          </div>
        </Box>

        {/* Info Cards */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Box className="card-ems-static" sx={{ p: 4 }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  className="form-input-ems" 
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email</label>
                <input type="email" className="form-input-ems" value={user?.email || ''} readOnly style={{ background: '#f8fafc' }} title="Contact HR to change email" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Phone</label>
                <input 
                  type="tel" 
                  className="form-input-ems" 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department</label>
                <input type="text" className="form-input-ems" value={departmentName} readOnly style={{ background: '#f8fafc' }} title="Contact HR to change department" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Birthdate</label>
                <input 
                  type="date" 
                  className="form-input-ems" 
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button 
                className="btn-ems btn-ems-primary" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : <><Save size={16} className="mr-1 inline" /> Save Changes</>}
              </button>
            </div>
          </Box>

          <Box className="card-ems-static" sx={{ p: 4, opacity: 0.6 }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Security (Coming Soon)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Current Password</label>
                <input type="password" className="form-input-ems" placeholder="••••••••" disabled />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">New Password</label>
                <input type="password" className="form-input-ems" placeholder="••••••••" disabled />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button className="btn-ems btn-ems-primary" disabled>Update Password</button>
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
