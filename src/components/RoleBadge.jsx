import React from 'react';
import { Chip } from '@mui/material';
import { getRoleDisplay, getRoleBadgeColor } from '../utils/roleHelpers';

const RoleBadge = ({ role, size = 'small' }) => {
  const display = getRoleDisplay(role);
  const colors = getRoleBadgeColor(role);

  return (
    <Chip
      label={display}
      size={size}
      sx={{
        height: size === 'small' ? 24 : 28,
        fontSize: size === 'small' ? 10 : 12,
        fontWeight: 700,
        letterSpacing: '0.03em',
        backgroundColor: colors.bg,
        color: colors.color,
        fontFamily: 'Inter, sans-serif',
        '& .MuiChip-label': {
          px: 1.2,
        }
      }}
    />
  );
};

export default RoleBadge;
