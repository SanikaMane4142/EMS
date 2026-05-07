import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Box, Typography, Button } from '@mui/material';

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        p: 3,
        textAlign: 'center',
        bgcolor: '#fef2f2'
      }}
    >
      <Typography variant="h4" color="error" gutterBottom sx={{ fontWeight: 'bold' }}>
        Oops! Something went wrong.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
        {error.message || "An unexpected error occurred. Our team has been notified."}
      </Typography>
      <Button 
        variant="contained" 
        color="primary" 
        onClick={resetErrorBoundary}
        sx={{ borderRadius: 2 }}
      >
        Try Again
      </Button>
    </Box>
  );
};

export const GlobalErrorBoundary = ({ children }) => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset state if needed, or simply reload the page
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
