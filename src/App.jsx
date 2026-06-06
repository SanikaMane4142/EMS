import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { Toaster } from 'react-hot-toast';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import Departments from './pages/Departments';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import LeaveManagement from './pages/LeaveManagement';
import Reports from './pages/Reports';
import UsersPage from './pages/Users';
import Settings from './pages/Settings';
import MyAttendance from './pages/MyAttendance';
import MyLeaves from './pages/MyLeaves';
import DailyLogs from './pages/DailyLogs';
import MyProfile from './pages/MyProfile';
import MyDocuments from './pages/MyDocuments';
import MyTasks from './pages/MyTasks';
import AdminTaskView from './pages/AdminTaskView';
import ChatModule from './pages/ChatModule';
import MyTeam from './pages/MyTeam';
import MyCalendar from './pages/MyCalendar';
import MyAnalytics from './pages/MyAnalytics';
import IpManagement from './pages/IpManagement';

// Components
import ProtectedRoute from './routes/ProtectedRoute';
import { useRealtimeSync } from './hooks/useRealtimeSync';

// MUI Theme
const muiTheme = createTheme({
  palette: {
    primary: { main: '#4f46e5' },
    secondary: { main: '#7c3aed' },
    success: { main: '#10b981' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    info: { main: '#3b82f6' },
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        }
      }
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
        },
        invisible: {
          backdropFilter: 'none',
          backgroundColor: 'transparent',
        }
      }
    }
  }
});

const RealtimeSyncManager = () => {
  useRealtimeSync();
  return null;
};

function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RealtimeSyncManager />
        <Toaster position="top-right" reverseOrder={false} />
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
          <AuthProvider>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Role-Specific Dashboards */}
                <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={['super_admin']}><Dashboard /></ProtectedRoute>} />
                <Route path="/hr-dashboard" element={<ProtectedRoute allowedRoles={['hr']}><Dashboard /></ProtectedRoute>} />
                <Route path="/employee-dashboard" element={<ProtectedRoute allowedRoles={['employee']}><Dashboard /></ProtectedRoute>} />

                {/* Admin/HR Management Routes */}
                <Route path="/employees" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><Employees /></ProtectedRoute>} />
                <Route path="/employee/:id" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><EmployeeProfile /></ProtectedRoute>} />
                <Route path="/departments" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><Departments /></ProtectedRoute>} />
                <Route path="/attendance" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><Attendance /></ProtectedRoute>} />
                <Route path="/payroll" element={<ProtectedRoute allowedRoles={['super_admin']}><Payroll /></ProtectedRoute>} />
                <Route path="/leave" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><LeaveManagement /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']} allowedDepartments={['ops', 'operations']}><Reports /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={['super_admin']}><UsersPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><Settings /></ProtectedRoute>} />
                <Route path="/organization-tasks" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']} allowedDepartments={['ops', 'operations']}><AdminTaskView /></ProtectedRoute>} />
                <Route path="/ip-management" element={<ProtectedRoute allowedRoles={['hr', 'super_admin']}><IpManagement /></ProtectedRoute>} />

                {/* Employee Modules */}
                <Route path="/my-attendance" element={<ProtectedRoute allowedRoles={['employee']}><MyAttendance /></ProtectedRoute>} />
                <Route path="/my-leaves" element={<ProtectedRoute allowedRoles={['employee']}><MyLeaves /></ProtectedRoute>} />
                <Route path="/daily-logs" element={<ProtectedRoute allowedRoles={['employee']}><DailyLogs /></ProtectedRoute>} />
                <Route path="/my-team" element={<ProtectedRoute allowedRoles={['employee']}><MyTeam /></ProtectedRoute>} />
                <Route path="/my-calendar" element={<ProtectedRoute allowedRoles={['employee']}><MyCalendar /></ProtectedRoute>} />
                <Route path="/my-analytics" element={<ProtectedRoute allowedRoles={['employee']}><MyAnalytics /></ProtectedRoute>} />
                <Route path="/my-documents" element={<ProtectedRoute allowedRoles={['employee']}><MyDocuments /></ProtectedRoute>} />
                <Route path="/my-tasks" element={<ProtectedRoute allowedRoles={['employee', 'hr', 'super_admin']}><MyTasks /></ProtectedRoute>} />
                <Route path="/my-tasks/:id" element={<ProtectedRoute allowedRoles={['employee', 'hr', 'super_admin']}><MyTasks /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute allowedRoles={['employee']}><ChatModule /></ProtectedRoute>} />

                {/* Shared Routes */}
                <Route path="/profile" element={<ProtectedRoute allowedRoles={['employee', 'hr', 'super_admin']}><MyProfile /></ProtectedRoute>} />


                {/* Default Navigation */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />

              </Routes>
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
