import React from 'react';
import { Box, Typography } from '@mui/material';

const DataTable = ({ columns, data, onRowClick, emptyMessage = 'No data available.' }) => {
  if (!data || data.length === 0) {
    return (
      <Box className="card-ems-static" sx={{ p: 4 }}>
        <div className="empty-state-ems">
          <p className="text">{emptyMessage}</p>
        </div>
      </Box>
    );
  }

  return (
    <Box className="card-ems-static" sx={{ overflow: 'hidden' }}>
      <div className="table-responsive">
        <table className="table-ems" style={{ width: '100%' }}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} style={{ textAlign: col.align || 'left', minWidth: col.minWidth }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                aria-label={onRowClick ? `View details for row ${rowIdx + 1}` : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
};

export default DataTable;
