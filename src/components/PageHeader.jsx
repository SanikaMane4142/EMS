import React from 'react';
import { Box, Typography } from '@mui/material';

const PageHeader = ({ title, subtitle, children }) => {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 2, mb: 3
    }}>
      <Box>
        <Typography sx={{
          fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: '#0f172a',
          fontFamily: 'Inter, sans-serif', lineHeight: 1.2
        }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{
            fontSize: 13, color: '#64748b', fontWeight: 500,
            fontFamily: 'Inter, sans-serif', mt: 0.3
          }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {children && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {children}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
