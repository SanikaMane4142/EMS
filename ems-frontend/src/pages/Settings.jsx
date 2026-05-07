import React from 'react';
import { Box, Switch } from '@mui/material';
import { User, Bell, Shield, Globe, Lock, Mail, Camera } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const Settings = () => {
  return (
    <div>
      <PageHeader title="Settings" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Nav */}
        <div>
          <Box className="card-ems-static" sx={{ p: 1 }}>
            {[
              { label: 'Profile Settings', icon: User, active: true },
              { label: 'Notifications', icon: Bell },
              { label: 'Security', icon: Shield },
              { label: 'Integrations', icon: Globe },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <button key={i} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all text-left border-0 cursor-pointer ${item.active ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                  style={{ background: item.active ? '#eef2ff' : 'transparent' }}>
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
          </Box>
        </div>

        {/* Right Content */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Profile Section */}
          <Box className="card-ems-static" sx={{ p: 4 }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Personal Information</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-extrabold text-2xl">
                  JD
                </div>
                <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                  aria-label="Upload profile picture">
                  <Camera size={13} />
                </button>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Profile Picture</h4>
                <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
                <input type="text" className="form-input-ems" defaultValue="Jane Doe" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email Address</label>
                <input type="email" className="form-input-ems" defaultValue="jane.doe@ems.com" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department</label>
                <input type="text" className="form-input-ems" defaultValue="Human Resources" readOnly style={{ background: '#f8fafc' }} />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Role</label>
                <input type="text" className="form-input-ems" defaultValue="HR Manager" readOnly style={{ background: '#f8fafc' }} />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button className="btn-ems btn-ems-secondary">Cancel</button>
              <button className="btn-ems btn-ems-primary">Save Changes</button>
            </div>
          </Box>

          {/* Preferences */}
          <Box className="card-ems-static" sx={{ p: 4 }}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Preferences</h3>
            <div className="flex flex-col gap-5">
              {[
                { title: 'Email Notifications', desc: 'Receive daily updates on team activity via email.', icon: Mail },
                { title: 'Security Alerts', desc: 'Get notified about suspicious login attempts.', icon: Lock },
                { title: 'Push Notifications', desc: 'Browser notifications for leave approvals and reports.', icon: Bell },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-50 text-indigo-600">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <Switch defaultChecked color="primary" />
                  </div>
                );
              })}
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default Settings;
