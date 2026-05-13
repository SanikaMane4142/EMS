import React from 'react';
import { Box } from '@mui/material';
import { BarChart3 } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const MyAnalytics = () => {
  return (
    <div>
      <PageHeader title="Performance Analytics" subtitle="Track your productivity and growth" />
      <Box className="card-ems-static" sx={{ p: 5 }}>
        <div className="empty-state-ems">
          <BarChart3 size={48} className="icon" />
          <p className="text" style={{ fontSize: 16 }}>Performance analytics dashboard coming soon.</p>
          <p className="text-sm text-slate-400">Your productivity metrics and growth trends will appear here.</p>
        </div>
      </Box>
    </div>
  );
};

export default MyAnalytics;
