import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Briefcase, Lock, Mail, ShieldAlert } from 'lucide-react';
import { getDashboardRoute } from '../utils/roleHelpers';

const Login = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, user, profile, error: authError, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Handle Redirection on Success
  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate(getDashboardRoute(profile.role));
    }
  }, [user, profile, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);

    if (!employeeId || !password) {
      setLocalError('Please fill in all fields');
      setIsSubmitting(false);
      return;
    }

    try {
      await login(employeeId, password);
    } catch (err) {
      console.error('Login error:', err);
      setLocalError(err.message || 'Invalid login credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };



  const displayError = localError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #e0e7ff 100%)' }}>

      <Box sx={{
        width: '100%', maxWidth: 420, bgcolor: '#fff',
        borderRadius: '20px', p: { xs: 3, sm: 4 },
        boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.12)',
        border: '1px solid #f1f5f9',
      }}>
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Briefcase size={28} />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">EMS Pro Login</h1>
          <p className="text-sm text-slate-500 font-medium">Production-Grade Security Enabled</p>
        </div>

        {displayError && (
          <div className="alert-ems danger mb-4 text-xs flex items-center gap-2">
            <ShieldAlert size={14} />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Employee ID</label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" className="form-input-ems pl-10"
                placeholder="Enter Employee ID"
                value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isSubmitting || authLoading}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-semibold text-slate-700 block">Password</label>
              <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700 font-bold">Forgot?</a>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password" className="form-input-ems pl-10"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || authLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-ems btn-ems-primary w-full"
            style={{ height: 48, fontSize: 15, marginTop: 4 }}
            disabled={isSubmitting || authLoading}
          >
            {(isSubmitting || authLoading) ? 'Verifying Identity...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Security Notice</p>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Your login will be verified against the database. Your role will be automatically determined from your profile.
          </p>
        </div>
      </Box>
    </div>
  );
};

export default Login;
