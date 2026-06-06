import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { canAccess, getDashboardRoute } from '../utils/roleHelpers';

const ProtectedRoute = ({ children, allowedRoles, allowedDepartments }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Show spinner while:
  // 1. Auth is still initializing (loading=true), OR
  // 2. User session exists but profile hasn't finished loading yet
  //    (race condition: onAuthStateChange sets loading=false before
  //     verifyAndFetchProfile completes — without this guard the login
  //     page flashes for a split second on every refresh)
  if (loading || (user && !profile)) {
    return <LoadingSpinner fullPage message="Verifying security credentials..." />;
  }

  // No active session? Go to login, preserving the intended destination.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Profile confirmed missing in DB — redirect to login.
  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permissions using the database role
  let hasAccess = false;
  
  if (!allowedRoles || allowedRoles.length === 0) {
    hasAccess = true;
  } else if (allowedRoles && canAccess(profile.role, allowedRoles)) {
    hasAccess = true;
  }
  
  if (!hasAccess && allowedDepartments && profile.departments) {
    const deptName = profile.departments.name?.toLowerCase() || '';
    if (allowedDepartments.some(d => deptName.includes(d))) {
      hasAccess = true;
    }
  }

  if (!hasAccess && (allowedRoles || allowedDepartments)) {
    // If they can't access this specific dashboard, send them to THEIR dashboard
    return <Navigate to={getDashboardRoute(profile.role)} replace />;
  }

  return <Layout>{children}</Layout>;
};


export default ProtectedRoute;
