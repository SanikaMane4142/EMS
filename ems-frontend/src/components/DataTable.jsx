import React from 'react';
import { Box } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

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

  // Convert custom columns to DataGrid columns
  const dataGridColumns = columns.map((col, i) => ({
    field: col.key || `col-${i}`,
    headerName: col.header,
    flex: 1,
    minWidth: col.minWidth || 100,
    align: col.align || 'left',
    headerAlign: col.align || 'left',
    renderCell: (params) => {
      if (col.render) {
        return col.render(params.value, params.row);
      }
      return params.value;
    },
    sortable: true,
  }));

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
          '& .MuiDataGrid-row': {
            cursor: onRowClick ? 'pointer' : 'default',
          }
        }}
      />
    </Box>
  );
};

export default DataTable;
