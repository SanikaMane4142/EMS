import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Drawer, Avatar, Chip, Menu, MenuItem,
  Badge, Tooltip, Box, Divider, useMediaQuery, useTheme, Typography
} from '@mui/material';
import {
  Menu as MenuIcon, X, Bell, ChevronRight, LogOut, User, Settings, Briefcase, Rocket
} from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabaseClient';
import { getNavLinks, getRoleDisplay, getRoleBadgeColor, getBreadcrumbs, getPageTitle, getDashboardRoute } from '../utils/roleHelpers';
import { notificationService } from '../services/notificationService';
import Breadcrumb from './Breadcrumb';

// Simple time-ago helper to replace date-fns
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "just now";
};

const Layout = ({ children }) => {
  const { user, profile, logout, fullName, roleTitle } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:768px)');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const navLinks = profile ? getNavLinks(profile.role, profile) : [];
  const roleBadge = profile ? getRoleBadgeColor(profile.role) : {};

  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      try {
        const data = await notificationService.getMyNotifications();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifs();

    // Real-time notifications
    const channel = supabase
      .channel(`user_notifications_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, () => fetchNotifs())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };


  const handleLogout = async () => {
    setProfileAnchor(null);
    setNotifAnchor(null);
    setDrawerOpen(false);

    const result = await Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to end your session?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Logout',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
    });

    if (result.isConfirmed) {
      try {
        await logout();
      } catch (err) {
        console.error('Logout failed:', err);
      } finally {
        // Prevent stale modal/backdrop overlays from trapping the UI.
        Swal.close();
        document.body.classList.remove('swal2-height-auto');
        document.body.style.removeProperty('overflow');
        navigate('/login', { replace: true });
        // Hard fallback in case router navigation is blocked by transient UI state.
        setTimeout(() => {
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }, 150);
      }
    }
  };





  const handleNavClick = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  // ===== Drawer Content (Mobile) =====
  const drawerContent = (
    <Box
      sx={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Drawer Header */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box component="img" src="/logo.png" sx={{ width: 36, height: 36, borderRadius: '8px' }} alt="Logo" />
          <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
            EMS <span style={{ color: '#4f46e5' }}>Cocpit</span>
          </Typography>
        </Box>
        <IconButton onClick={() => setDrawerOpen(false)} size="small" aria-label="Close menu">
          <X size={20} />
        </IconButton>
      </Box>

      {/* Drawer User Info */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #f1f5f9' }}>
        <Avatar sx={{ width: 40, height: 40, bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 14 }}>
          {fullName.charAt(0)}
        </Avatar>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'Inter' }}>{fullName}</Typography>
          <Chip
            label={roleTitle}
            size="small"
            sx={{
              height: 22, fontSize: 10, fontWeight: 700,
              backgroundColor: roleBadge.bg, color: roleBadge.color,
              mt: 0.3
            }}
          />
        </Box>
      </Box>

      {/* Drawer Nav Links */}
      <Box sx={{ flex: 1, py: 1, px: 1.5, overflowY: 'auto' }}>
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Box
              key={link.to}
              onClick={() => handleNavClick(link.to)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1.2, mb: 0.3,
                borderRadius: '10px', cursor: 'pointer',
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? '#4f46e5' : '#64748b',
                backgroundColor: active ? '#eef2ff' : 'transparent',
                transition: 'all 0.2s',
                '&:hover': { backgroundColor: '#f1f5f9', color: '#4f46e5' },
                position: 'relative',
              }}
              role="link"
              tabIndex={0}
              aria-current={active ? 'page' : undefined}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNavClick(link.to); }}
            >
              {active && (
                <Box sx={{
                  position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
                  background: '#4f46e5', borderRadius: '0 4px 4px 0'
                }} />
              )}
              <Icon size={18} />
              <span>{link.label}</span>
            </Box>
          );
        })}
      </Box>

      {/* Drawer Footer */}
      <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0' }}>
        <Box
          onClick={() => handleNavClick('/profile')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.5, py: 1, mb: 0.5, borderRadius: '10px', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, color: '#64748b',
            '&:hover': { backgroundColor: '#f1f5f9', color: '#4f46e5' }
          }}
        >
          <User size={18} /> <span>My Profile</span>
        </Box>
        <Box
          onClick={handleLogout}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.5, py: 1, borderRadius: '10px', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, color: '#ef4444',
            '&:hover': { backgroundColor: '#fef2f2' }
          }}
        >
          <LogOut size={18} /> <span>Sign Out</span>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* ===== Top Navbar ===== */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          zIndex: 1200,
        }}
      >
        <Toolbar
          sx={{
            height: 64, minHeight: '64px !important',
            maxWidth: 1400, width: '100%', mx: 'auto',
            px: { xs: 2, md: 3 },
            display: 'flex', justifyContent: 'space-between',
          }}
        >
          {/* Left: Logo + Hamburger */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
            {isMobile && (
              <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open menu" sx={{ color: '#64748b' }}>
                <MenuIcon size={22} />
              </IconButton>
            )}
            <Link to={profile ? getDashboardRoute(profile.role) : '/dashboard'} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <Box component="img" src="/logo.png" sx={{ width: 36, height: 36, borderRadius: '8px', flexShrink: 0 }} alt="Logo" />
              <Typography sx={{
                fontSize: 18, fontWeight: 800, color: '#0f172a',
                fontFamily: 'Inter, sans-serif', display: { xs: 'none', sm: 'block' }
              }}>
                EMS <span style={{ color: '#4f46e5' }}>Cocpit</span>
              </Typography>
            </Link>
          </Box>

          {/* Center: Desktop Nav Links */}
          {!isMobile && (
            <Box
              component="nav"
              aria-label="Main navigation"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{ textDecoration: 'none' }}
                  >
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 0.8,
                      px: 1.5, py: 0.8, borderRadius: '8px',
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? '#4f46e5' : '#64748b',
                      backgroundColor: active ? '#eef2ff' : 'transparent',
                      transition: 'all 0.2s',
                      '&:hover': { backgroundColor: '#f1f5f9', color: '#4f46e5' },
                      whiteSpace: 'nowrap',
                    }}>
                      <Icon size={16} />
                      {link.label}
                    </Box>
                  </Link>
                );
              })}
            </Box>
          )}

          {/* Right: Notifications + Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1.5 } }}>
            {/* Notification Bell */}
            <Tooltip title="Notifications" arrow>
              <IconButton
                size="small"
                aria-label="Notifications"
                onClick={(e) => setNotifAnchor(e.currentTarget)}
                sx={{
                  width: 38, height: 38, borderRadius: '10px',
                  border: '1px solid #e2e8f0', color: '#64748b',
                  '&:hover': { background: '#f8fafc', color: '#4f46e5' }
                }}
              >
                <Badge badgeContent={unreadCount} color="error" 
                  sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16, border: '2px solid #fff' } }}
                >
                  <Bell size={18} />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Notifications Menu */}
            <Menu
              anchorEl={notifAnchor}
              open={Boolean(notifAnchor)}
              onClose={() => setNotifAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1, width: 320, maxHeight: 480, borderRadius: '16px',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
                    border: '1px solid #f1f5f9', overflow: 'hidden'
                  }
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Notifications</Typography>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </Box>
              <Box sx={{ overflowY: 'auto', maxHeight: 400 }}>
                {notifications.length === 0 ? (
                  <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
                    <Bell size={32} className="mx-auto mb-2 text-slate-200" />
                    <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>No notifications yet</Typography>
                  </Box>
                ) : (
                  notifications.map((n) => (
                    <MenuItem 
                      key={n.id} 
                      onClick={() => {
                        notificationService.markAsRead(n.id);
                        setNotifAnchor(null);
                        setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, is_read: true } : notif));
                        setUnreadCount(prev => Math.max(0, prev - (n.is_read ? 0 : 1)));
                        if (n.link) navigate(n.link);
                      }}
                      sx={{ 
                        px: 2, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        borderBottom: '1px solid #f8fafc',
                        backgroundColor: n.is_read ? 'transparent' : '#eef2ff',
                        '&:hover': { backgroundColor: n.is_read ? '#f8fafc' : '#e0e7ff' }
                      }}
                    >
                      <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{n.title}</Typography>
                        <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>
                          {timeAgo(n.created_at)}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, whiteSpace: 'normal' }}>
                        {n.message}
                      </Typography>
                    </MenuItem>
                  ))
                )}
              </Box>
            </Menu>

            {/* Profile Dropdown Trigger */}
            <Box
              onClick={(e) => setProfileAnchor(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.2,
                px: { xs: 0.5, md: 1.2 }, py: 0.6,
                borderRadius: '12px', cursor: 'pointer',
                transition: 'all 0.2s', border: '1px solid transparent',
                '&:hover': { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
              }}
              role="button"
              tabIndex={0}
              aria-label="Open profile menu"
              aria-haspopup="true"
              onKeyDown={(e) => { if (e.key === 'Enter') setProfileAnchor(e.currentTarget); }}
            >
              <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, fontFamily: 'Inter' }}>
                  {fullName}
                </Typography>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2, fontFamily: 'Inter' }}>
                  {roleTitle}
                </Typography>
              </Box>
              <Avatar sx={{
                width: 36, height: 36, bgcolor: '#eef2ff', color: '#4f46e5',
                fontWeight: 800, fontSize: 14, borderRadius: '10px'
              }}>
                {fullName.charAt(0)}
              </Avatar>
            </Box>


            {/* Profile Dropdown Menu */}
            <Menu
              anchorEl={profileAnchor}
              open={Boolean(profileAnchor)}
              onClose={() => setProfileAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1, minWidth: 200, borderRadius: '12px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                    border: '1px solid #f1f5f9'
                  }
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'Inter' }}>{fullName}</Typography>
                <Typography sx={{ fontSize: 12, color: '#64748b', fontFamily: 'Inter' }}>{user?.email}</Typography>
                <Chip
                  label={roleTitle}
                  size="small"
                  sx={{
                    mt: 0.8, height: 22, fontSize: 10, fontWeight: 700,
                    backgroundColor: roleBadge.bg, color: roleBadge.color,
                  }}
                />
              </Box>
              <MenuItem onClick={() => { setProfileAnchor(null); navigate('/profile'); }}
                sx={{ fontSize: 13, fontWeight: 500, py: 1.2, gap: 1.5, fontFamily: 'Inter' }}>
                <User size={16} /> My Profile
              </MenuItem>
              <MenuItem onClick={() => { setProfileAnchor(null); navigate('/settings'); }}
                sx={{ fontSize: 13, fontWeight: 500, py: 1.2, gap: 1.5, fontFamily: 'Inter' }}>
                <Settings size={16} /> Settings
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                sx={{ fontSize: 13, fontWeight: 500, py: 1.2, gap: 1.5, color: '#ef4444', fontFamily: 'Inter' }}
              >
                <LogOut size={16} /> Sign Out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>


      {/* ===== Mobile Drawer ===== */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            borderRight: 'none',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
          }
        }}
      >
        {drawerContent}
      </Drawer>

      {/* ===== Breadcrumb Bar ===== */}
      <Box sx={{ mt: '64px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
        <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Breadcrumb />
        </Box>
      </Box>

      {/* ===== Main Content ===== */}
      <Box
        component="main"
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: 3,
          minHeight: 'calc(100vh - 64px - 44px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
