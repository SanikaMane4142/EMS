import React from 'react';
import { Box, Typography } from '@mui/material';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color = '#4f46e5', bgColor = '#eef2ff', trend, trendValue, onClick }) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)',
          borderColor: '#c7d2fe',
        },
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient overlay */}
      <Box sx={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: `radial-gradient(circle at top right, ${bgColor}80, transparent 70%)`,
        borderRadius: '50%', transform: 'translate(30px, -30px)', pointerEvents: 'none'
      }} />

      {/* Icon */}
      <Box sx={{
        width: 48, height: 48, borderRadius: '12px',
        background: bgColor, color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative'
      }}>
        {Icon && <Icon size={22} />}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Typography sx={{
          fontSize: 12, fontWeight: 600, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          marginBottom: '2px', fontFamily: 'Inter, sans-serif'
        }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{
            fontSize: 26, fontWeight: 800, color: '#0f172a',
            lineHeight: 1.1, fontFamily: 'Inter, sans-serif'
          }}>
            {value}
          </Typography>
          {trend && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.3,
              fontSize: 11, fontWeight: 700,
              color: trend === 'up' ? '#10b981' : '#ef4444',
            }}>
              {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trendValue}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default StatCard;
