import {
  LayoutDashboard, Users, Clock, CalendarOff, FileText, Building,
  DollarSign, BarChart3, Shield, Briefcase, User, CheckSquare, ListTodo, Globe
} from 'lucide-react';

// ===== Role Display Mapping =====
const ROLE_MAP = {
  super_admin: 'SUPER_ADMIN',
  hr: 'ADMIN',
  employee: 'EMPLOYEE',
};

const ROLE_COLORS = {
  SUPER_ADMIN: { bg: '#f3e8ff', color: '#7c3aed', muiColor: 'secondary' },
  ADMIN: { bg: '#dbeafe', color: '#2563eb', muiColor: 'primary' },
  EMPLOYEE: { bg: '#dcfce7', color: '#16a34a', muiColor: 'success' },
};


export const getRoleDisplay = (dbRole) => ROLE_MAP[dbRole] || dbRole?.toUpperCase() || 'UNKNOWN';

export const getRoleBadgeColor = (dbRole) => {
  const display = getRoleDisplay(dbRole);
  return ROLE_COLORS[display] || ROLE_COLORS.EMPLOYEE;
};

export const canAccess = (userRole, allowedDbRoles) => {
  if (!allowedDbRoles || allowedDbRoles.length === 0) return true;
  return allowedDbRoles.includes(userRole);
};

export const getDashboardRoute = (dbRole) => {
  const routes = {
    super_admin: '/admin-dashboard',
    hr: '/hr-dashboard',
    employee: '/employee-dashboard',
  };
  return routes[dbRole] || '/login';
};




// ===== Navigation Configuration =====
export const getNavLinks = (dbRole) => {
  const allLinks = [
    {
      to: getDashboardRoute(dbRole),
      icon: LayoutDashboard,
      label: 'Dashboard',
      roles: ['super_admin', 'hr', 'employee'],
    },
    {
      to: '/employees',
      icon: Users,
      label: 'Employees',
      roles: ['super_admin', 'hr'],
    },

    {
      to: '/attendance',
      icon: Clock,
      label: 'Attendance',
      roles: ['super_admin', 'hr'],
    },
    {
      to: '/my-attendance',
      icon: Clock,
      label: 'My Attendance',
      roles: ['employee'],
    },
    /*
    {
      to: '/payroll',
      icon: DollarSign,
      label: 'Payroll',
      roles: ['super_admin'],
    },
    */
    {
      to: '/leave',
      icon: CalendarOff,
      label: 'Leave Management',
      roles: ['super_admin', 'hr'],
    },
    {
      to: '/my-leaves',
      icon: CalendarOff,
      label: 'My Leaves',
      roles: ['employee'],
    },
    {
      to: '/reports',
      icon: BarChart3,
      label: 'Reports',
      roles: ['super_admin', 'hr'],
    },
    {
      to: '/my-tasks',
      icon: CheckSquare,
      label: 'Tasks',
      roles: ['employee'],
    },
    {
      to: '/organization-tasks',
      icon: ListTodo,
      label: 'Org Tasks',
      roles: ['super_admin', 'hr'],
    },
    {
      to: '/departments',
      icon: Building,
      label: 'Departments',
      roles: ['super_admin', 'hr'],
    },

    {
      to: '/users',
      icon: Shield,
      label: 'Users',
      roles: ['super_admin'],
    },
    {
      to: '/ip-management',
      icon: Globe,
      label: 'Network Security',
      roles: ['super_admin', 'hr'],
    },


  ];

  return allLinks.filter(link => link.roles.includes(dbRole));
};

// ===== Page Title Mapping =====
export const getPageTitle = (pathname) => {
  const titleMap = {
    '/dashboard': 'Dashboard',
    '/employees': 'Employees',

    '/attendance': 'Attendance',
    '/my-attendance': 'My Attendance',
    '/payroll': 'Payroll',
    '/leave': 'Leave Management',
    '/my-leaves': 'My Leaves',
    '/reports': 'Reports & Analytics',
    '/users': 'User Management',
    '/profile': 'My Profile',
    '/settings': 'Settings',
    '/daily-logs': 'Daily Work Log',
    '/my-tasks': 'My Tasks & Goals',
    '/organization-tasks': 'Organization Task Tracking',
    '/my-documents': 'My Documents',
    '/my-team': 'My Team',
    '/my-calendar': 'Calendar',
    '/my-analytics': 'Performance Analytics',
    '/chat': 'Messages',
    '/ip-management': 'Network Security',
  };

  if (pathname.includes('/employee/')) return 'Employee Profile';
  return titleMap[pathname] || 'Dashboard';
};

// ===== Breadcrumb Generation =====
export const getBreadcrumbs = (pathname, dbRole) => {
  const segments = pathname.split('/').filter(Boolean);
  const homePath = dbRole ? getDashboardRoute(dbRole) : '/dashboard';
  const crumbs = [{ label: 'Home', path: homePath }];

  const labelMap = {
    'admin-dashboard': 'Dashboard',
    'hr-dashboard': 'Dashboard',
    'employee-dashboard': 'Dashboard',
    'dashboard': 'Dashboard',
    'employees': 'Employees',

    'attendance': 'Attendance',
    'my-attendance': 'My Attendance',
    'payroll': 'Payroll',
    'leave': 'Leave Management',
    'my-leaves': 'My Leaves',
    'reports': 'Reports',
    'users': 'Users',
    'profile': 'My Profile',
    'settings': 'Settings',
    'daily-logs': 'Daily Work Log',
    'my-tasks': 'My Tasks',
    'organization-tasks': 'Org Tasks',
    'my-documents': 'My Documents',
    'my-team': 'My Team',
    'my-calendar': 'Calendar',
    'my-analytics': 'Performance',
    'chat': 'Messages',
    'ip-management': 'Security',
  };

  let currentPath = '';
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    // Check for dynamic label override in localStorage (e.g., for task names)
    const storedLabel = localStorage.getItem(`breadcrumb_label_${segment}`);
    const label = storedLabel || labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    crumbs.push({ label, path: currentPath });
  });

  return crumbs;
};
