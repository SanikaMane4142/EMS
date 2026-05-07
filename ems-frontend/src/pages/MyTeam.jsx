import React from 'react';
import { Box } from '@mui/material';
import { Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const MyTeam = () => {
  return (
    <div>
      <PageHeader title="My Team" subtitle="View and collaborate with your team members" />
      <Box className="card-ems-static" sx={{ p: 5 }}>
        <div className="empty-state-ems">
          <Users size={48} className="icon" />
          <p className="text" style={{ fontSize: 16 }}>Team view coming soon.</p>
          <p className="text-sm text-slate-400">Your team members and collaboration tools will appear here.</p>
        </div>
      </Box>
    </div>
  );
};

export default MyTeam;
