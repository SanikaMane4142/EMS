import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { canAccess, getDashboardRoute } from '../utils/roleHelpers';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage message="Verifying security credentials..." />;
  }

  // No active session? Go to login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Profile not found? Something went wrong with DB.
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Check permissions using the database role
  if (allowedRoles && !canAccess(profile.role, allowedRoles)) {
    // If they can't access this specific dashboard, send them to THEIR dashboard
    return <Navigate to={getDashboardRoute(profile.role)} replace />;
  }

  return <Layout>{children}</Layout>;
};


export default ProtectedRoute;
