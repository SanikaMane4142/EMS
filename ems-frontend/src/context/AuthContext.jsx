import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { queryClient } from '../lib/queryClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
  };

  const safeSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err?.message || err);
    } finally {
      clearAuthState();
    }
  };

  /**
   * PRODUCTION ROLE VERIFICATION
   * Fetches profile and enforces strict access rules
   */
  const verifyAndFetchProfile = async (userId, expectedRole = null) => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        // PGRST116 = "no rows returned" — actual missing profile
        if (profileError.code === 'PGRST116') {
          setError('Profile not found. Please contact your administrator.');
        } else {
          // Any other DB error (bad join, network, etc.)
          console.error('Profile fetch error:', profileError.message);
          setError('Failed to load profile. Please try again.');
        }
        await safeSignOut();
        return null;
      }
      if (!data) {
        setError('Profile not found. Please contact your administrator.');
        await safeSignOut();
        return null;
      }

      if (data.status === 'inactive') {
        await safeSignOut();
        setError('Your account has been deactivated.');
        return null;
      }

      if (expectedRole && data.role !== expectedRole) {
        const isAdminLevel = (r) => r === 'super_admin' || r === 'admin' || r === 'hr';
        if (data.role === 'super_admin' && isAdminLevel(expectedRole)) {
          // Allow
        } else {
          await safeSignOut();
          setError(`Role mismatch: you are registered as ${data.role.toUpperCase()}, not ${expectedRole.toUpperCase()}.`);
          return null;
        }
      }

      setProfile(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('verifyAndFetchProfile error:', err.message);
      setError('Failed to load profile. Please try again.');
      await safeSignOut();
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          if (session) {
            setUser(session.user);
            await verifyAndFetchProfile(session.user.id);
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log('[Auth] State Change:', event);

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          queryClient.clear();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        try {
          if (session) {
            setUser(session.user);
            // Note: verifyAndFetchProfile handles internal error state
            await verifyAndFetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
        } catch (err) {
          console.error('Auth listener processing error:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (employeeId, password) => {
    setError(null);

    // Fetch the email associated with the employee ID using RPC
    const { data: email, error: fetchError } = await supabase.rpc('get_email_by_employee_id', { emp_id: employeeId });

    if (fetchError || !email) {
      throw new Error('Invalid employee ID');
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;

    const verifiedProfile = await verifyAndFetchProfile(data.user.id);
    if (!verifiedProfile) {
      // Error already set in state by verifyAndFetchProfile
      throw new Error('Login failed. Please check your profile mapping and role.');
    }
    return data.user;
  };

  const logout = async () => {
    try {
      queryClient.clear();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase logout error:', err.message);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };


  const value = {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    fullName: profile?.full_name || user?.email || 'User',

    roleTitle: profile?.role?.toUpperCase() || 'EMPLOYEE',
    isAdmin: profile?.role === 'super_admin' || profile?.role === 'hr',
    isSuperAdmin: profile?.role === 'super_admin',
    isHR: profile?.role === 'hr',
    isEmployee: profile?.role === 'employee',


  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>

  );
};

export const useAuth = () => useContext(AuthContext);
