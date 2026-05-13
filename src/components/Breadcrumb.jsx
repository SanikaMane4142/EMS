import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Breadcrumbs, Typography, Box } from '@mui/material';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBreadcrumbs } from '../utils/roleHelpers';

const Breadcrumb = () => {
  const location = useLocation();
  const { profile } = useAuth();
  
  // Force re-render when localStorage changes (for dynamic labels)
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const handleStorage = () => setTick(t => t + 1);
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const crumbs = getBreadcrumbs(location.pathname, profile?.role);

  if (crumbs.length <= 1) return null;

  return (
    <Box sx={{ py: 1.2 }}>
      <Breadcrumbs
        separator={<ChevronRight size={14} style={{ color: '#cbd5e1' }} />}
        aria-label="breadcrumb"
        sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
      >
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return isLast ? (
            <Typography
              key={crumb.path}
              sx={{
                fontSize: 13, fontWeight: 600, color: '#0f172a',
                fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap'
              }}
            >
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={crumb.path}
              to={crumb.path}
              style={{
                fontSize: 13, fontWeight: 500, color: '#94a3b8',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {index === 0 && <Home size={14} />}
              {crumb.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

export default Breadcrumb;
