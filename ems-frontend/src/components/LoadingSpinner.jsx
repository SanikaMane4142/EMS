import React from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

const LoadingSpinner = ({ message = 'Loading...', fullPage = false }) => {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2,
      ...(fullPage ? {
        height: '100vh', width: '100%', position: 'fixed',
        top: 0, left: 0, background: '#f8fafc', zIndex: 9999
      } : {
        py: 8, width: '100%'
      })
    }}>
      <CircularProgress
        size={36}
        thickness={4}
        sx={{ color: '#4f46e5' }}
      />
      <Typography sx={{
        fontSize: 13, fontWeight: 600, color: '#64748b',
        fontFamily: 'Inter, sans-serif'
      }}>
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingSpinner;
