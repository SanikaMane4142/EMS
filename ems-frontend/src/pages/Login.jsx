import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Briefcase, Lock, Mail, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { getDashboardRoute } from '../utils/roleHelpers';

const Login = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        borderRadius: '24px', p: { xs: 3, sm: 5 },
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
        border: '1px solid #f1f5f9',
      }}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <Briefcase size={30} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">EMS Pro Login</h1>
          <p className="text-sm text-slate-500 font-semibold">Production-Grade Security Enabled</p>
        </div>

        {displayError && (
          <div className="alert-ems danger mb-6 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top duration-300">
            <ShieldAlert size={14} />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">Employee ID</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Briefcase size={18} />
              </div>
              <input
                type="text" className="form-input-premium w-full"
                style={{ paddingLeft: '48px' }}
                placeholder="Enter Employee ID"
                value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isSubmitting || authLoading}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2 px-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Password</label>
              <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700 font-bold transition-colors">Forgot?</a>
            </div>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input-premium w-full"
                style={{ paddingLeft: '48px', paddingRight: '48px' }}
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || authLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-ems btn-ems-primary w-full shadow-lg shadow-indigo-100"
            style={{ height: 52, fontSize: 16, marginTop: 8, borderRadius: '14px' }}
            disabled={isSubmitting || authLoading}
          >
            {(isSubmitting || authLoading) ? 'Verifying Identity...' : 'Sign In'}
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
