import React from 'react';
import { useAuth } from '../context/AuthContext';
import EmployeeDashboard from './EmployeeDashboard';
import HRDashboard from './HRDashboard';
import AdminDashboard from './AdminDashboard';

const Dashboard = () => {
  const { profile, loading } = useAuth();

  if (loading) return null; // Wait for profile to load

  if (profile?.role === 'super_admin') return <AdminDashboard />;
  if (profile?.role === 'hr') return <HRDashboard />;

  return <EmployeeDashboard />;
};


export default Dashboard;
