import React from 'react';
import { Box } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const DataTable = ({ columns, data, onRowClick, emptyMessage = 'No data available.', rowHeight = 64 }) => {
  if (!data || data.length === 0) {
    return (
      <Box className="card-ems-static" sx={{ p: 4 }}>
        <div className="empty-state-ems">
          <div className="text">{emptyMessage}</div>
        </div>
      </Box>
    );
  }

  // Convert custom columns to DataGrid columns
  const dataGridColumns = columns.map((col, i) => {
    const field = col.field || col.key || `col-${i}`;
    const headerName = col.headerName || col.header || field;

    return {
      minWidth: 100,
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      // Only apply flex: 1 if no width or flex is explicitly provided
      ...(!col.width && !col.flex ? { flex: 1 } : {}),
      ...col,
      field,
      headerName,
      renderCell: (params) => {
        if (col.renderCell) return col.renderCell(params);
        if (col.render) return col.render(params.value, params.row);
        return params.value;
      }
    };
  });

  // Ensure each row has an id
  const rows = data.map((row, index) => ({
    ...row,
    id: row.id || index, // DataGrid requires an 'id' field
  }));

  return (
    <Box className="card-ems-static" sx={{ overflow: 'hidden', width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={dataGridColumns}
        onRowClick={(params) => {
          if (onRowClick) onRowClick(params.row);
        }}
        autoHeight
        rowHeight={rowHeight}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 10 },
          },
        }}
        pageSizeOptions={[5, 10, 25, 50]}
        disableRowSelectionOnClick
        sx={{
          border: 'none',
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600, // Weight: 600
            fontSize: '13px', // Font size: 13px
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#64748b',
          },
          '& .MuiDataGrid-columnHeader': {
            position: 'relative',
            px: '20px !important',
            '&:not([data-field="employee"]):not([data-field="name"])::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: '25%',
              height: '50%',
              width: '1px',
              backgroundColor: '#f1f5f9',
            }
          },
          '& .MuiDataGrid-columnSeparator': {
            display: 'none',
          },
          '& .MuiDataGrid-row': {
            cursor: onRowClick ? 'pointer' : 'default',
            borderBottom: '1px solid #f8fafc',
            '&:hover': {
              backgroundColor: '#fcfdfe',
            }
          },
          '& .MuiDataGrid-cell': {
            borderBottom: 'none',
            px: '20px !important',
            py: '14px !important', // Vertical cell padding: 14px
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#fcfdfe',
            borderBottom: '1px solid #f1f5f9',
            minHeight: '52px !important',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid #f1f5f9',
            px: 3,
            pb: '16px', // Reduce bottom padding to 16px
            minHeight: '56px',
            '& .MuiTablePagination-root': {
              width: '100%',
            },
            '& .MuiTablePagination-spacer': {
              display: 'none',
            },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: '13px',
              fontWeight: 600,
              color: '#64748b',
            },
            '& .MuiTablePagination-actions': {
              marginLeft: '20px',
              display: 'flex',
              gap: '8px',
            },
            '& .MuiTablePagination-actions button': {
              width: 36,
              height: 36,
              borderRadius: '10px',
              border: '1px solid #f1f5f9',
              '&:hover': { bgcolor: '#f8fafc' },
              '& svg': { fontSize: '18px' }
            }
          }
        }}
      />
    </Box>
  );
};

export default DataTable;
