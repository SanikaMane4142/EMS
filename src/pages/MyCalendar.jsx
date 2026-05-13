import React from 'react';
import { Box } from '@mui/material';
import { Calendar } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const MyCalendar = () => {
  return (
    <div>
      <PageHeader title="Company Calendar" subtitle="View upcoming events and holidays" />
      <Box className="card-ems-static" sx={{ p: 5 }}>
        <div className="empty-state-ems">
          <Calendar size={48} className="icon" />
          <p className="text" style={{ fontSize: 16 }}>Calendar view coming soon.</p>
          <p className="text-sm text-slate-400">Company events, holidays, and your schedule will appear here.</p>
        </div>
      </Box>
    </div>
  );
};

export default MyCalendar;
