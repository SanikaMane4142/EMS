import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, Avatar } from '@mui/material';
import { Mail, Phone, MapPin, Calendar, Clock, Briefcase, Save, Eye, EyeOff } from 'lucide-react';
import RoleBadge from '../components/RoleBadge';
import PageHeader from '../components/PageHeader';
import { profileService } from '../services/profileService';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import Swal from 'sweetalert2';

const MyProfile = () => {
  const { user, profile, updatePassword } = useAuth();
  const [formData, setFormData] = useState({ full_name: '', phone: '', birthday: '' });
  const [securityData, setSecurityData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to update profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!securityData.currentPassword || !securityData.newPassword) {
      Swal.fire('Error', 'Please fill in all password fields.', 'error');
      return;
    }

    if (securityData.newPassword !== securityData.confirmPassword) {
      Swal.fire('Error', 'New passwords do not match.', 'error');
      return;
    }

    if (securityData.newPassword.length < 6) {
      Swal.fire('Error', 'Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      setSecurityLoading(true);
      
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { 
          auth: { 
            persistSession: false, 
            storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } 
          } 
        }
      );

      const { error: signInError } = await tempSupabase.auth.signInWithPassword({
        email: user.email,
        password: securityData.currentPassword,
      });

      if (signInError) {
        throw new Error('Incorrect current password');
      }

      const updatePromise = supabase.auth.updateUser({
        password: securityData.newPassword
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password update timed out. Please refresh the page.')), 15000)
      );

      const { error: updateError } = await Promise.race([updatePromise, timeoutPromise]);

      if (updateError) throw updateError;

      await Swal.fire('Success', 'Password updated successfully!', 'success');
      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
    } catch (err) {
      console.error('[MyProfile] Password update error:', err);
      Swal.fire('Error', err.message || 'Failed to update password.', 'error');
    } finally {
      setSecurityLoading(false);
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
              <span className="text-slate-600">Joined Company: {profile?.joining_date ? new Date(profile.joining_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock size={16} className="text-slate-400" />
              <span className="text-slate-600">Portal Access: {profile?.joined_at ? new Date(profile.joined_at).toLocaleDateString() : 'N/A'}</span>
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

          <Box className="card-ems-static" sx={{ p: 4 }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Security & Password</h3>
            <form onSubmit={handleUpdatePassword}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Current Password</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? "text" : "password"} 
                      className="form-input-ems pr-10" 
                      placeholder="••••••••" 
                      value={securityData.currentPassword}
                      onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">New Password</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      className="form-input-ems pr-10" 
                      placeholder="••••••••" 
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      className="form-input-ems pr-10" 
                      placeholder="••••••••" 
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
                <button 
                  type="submit"
                  className="btn-ems btn-ems-primary" 
                  disabled={securityLoading}
                >
                  {securityLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
