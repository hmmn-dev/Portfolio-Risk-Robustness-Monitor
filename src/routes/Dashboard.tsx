import { Box, Paper, Stack, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'

const columns: GridColDef[] = [
  { field: 'account', headerName: 'Account', flex: 1.2, minWidth: 160 },
  { field: 'region', headerName: 'Region', flex: 1, minWidth: 120 },
  {
    field: 'balance',
    headerName: 'Balance',
    flex: 1,
    minWidth: 130,
    valueFormatter: ({ value }) => `€${Number(value).toLocaleString()}`,
  },
  {
    field: 'delta',
    headerName: 'QoQ Change',
    flex: 0.8,
    minWidth: 120,
    valueFormatter: ({ value }) => `${Number(value).toFixed(1)}%`,
  },
]

const rows = [
  { id: 1, account: 'Northwind Capital', region: 'EU', balance: 12450000, delta: 4.2 },
  { id: 2, account: 'Sable Partners', region: 'APAC', balance: 8840000, delta: 2.1 },
  { id: 3, account: 'Monarch Holdings', region: 'US', balance: 15320000, delta: -1.3 },
  { id: 4, account: 'Oriel Ventures', region: 'ME', balance: 6420000, delta: 3.6 },
  { id: 5, account: 'Sterling Grove', region: 'UK', balance: 9720000, delta: 1.4 },
]

const Dashboard = () => {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3">Liquidity Overview</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          A quiet pulse across global desks with concentrated flows in energy and credit.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {[
          { label: 'Net Inflow', value: '€48.2M', detail: '+3.4% QoQ' },
          { label: 'Volatility Index', value: '12.8', detail: 'Tight range' },
          { label: 'Active Allocations', value: '214', detail: '12 pending reviews' },
        ].map((card) => (
          <Paper key={card.label} sx={{ p: 2.5, flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              {card.label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {card.value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {card.detail}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Strategic Accounts
        </Typography>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          rowHeight={52}
          sx={{
            border: 0,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            },
          }}
        />
      </Paper>
    </Stack>
  )
}

export default Dashboard
