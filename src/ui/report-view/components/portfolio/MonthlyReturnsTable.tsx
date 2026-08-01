import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { memo } from 'react'
import { isLightColor } from '../../colors'
import { formatSigned } from '../../formatters'
import { MONTH_LABELS, type MonthlyReturnRow } from '../../portfolio/portfolioCalculations'

const getHeatColor = (value: number | null, theme: Theme) => {
  if (!Number.isFinite(value ?? NaN)) return theme.palette.action.hover
  const magnitude = Math.abs(value as number)
  const level = magnitude >= 0.1 ? 2 : magnitude >= 0.03 ? 1 : 0
  const palette = (value as number) >= 0 ? theme.palette.success : theme.palette.error
  return level === 2 ? palette.dark : level === 1 ? palette.main : palette.light
}

const MonthlyReturnsTable = ({ rows, theme }: { rows: MonthlyReturnRow[]; theme: Theme }) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography component="h2" variant="subtitle1">
          Portfolio monthly returns
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Values in percent
        </Typography>
      </Stack>
      <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{ fontWeight: 700, minWidth: 64, borderRight: 1, borderColor: 'divider' }}
              >
                Year
              </TableCell>
              {MONTH_LABELS.map((label) => (
                <TableCell
                  key={label}
                  align="center"
                  sx={{ fontWeight: 700, minWidth: 56, borderRight: 1, borderColor: 'divider' }}
                >
                  {label}
                </TableCell>
              ))}
              <TableCell
                align="center"
                sx={{ fontWeight: 700, minWidth: 72, borderRight: 1, borderColor: 'divider' }}
              >
                Total
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, minWidth: 80 }}>
                MaxDD
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.year} hover>
                <TableCell sx={{ fontWeight: 700, borderRight: 1, borderColor: 'divider' }}>
                  {row.year}
                </TableCell>
                {row.months.map((value, index) => {
                  const backgroundColor = getHeatColor(value, theme)
                  return (
                    <TableCell
                      key={`${row.year}-${index}`}
                      align="center"
                      sx={{
                        backgroundColor,
                        color: isLightColor(backgroundColor)
                          ? theme.palette.text.primary
                          : theme.palette.common.white,
                        fontWeight: 700,
                        borderRight: 1,
                        borderColor: 'divider',
                      }}
                    >
                      {Number.isFinite(value ?? NaN)
                        ? formatSigned((value as number) * 100, 2, '%')
                        : '-'}
                    </TableCell>
                  )
                })}
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, borderRight: 1, borderColor: 'divider' }}
                >
                  {Number.isFinite(row.total ?? NaN)
                    ? formatSigned((row.total as number) * 100, 2, '%')
                    : '-'}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {Number.isFinite(row.maxDrawdown ?? NaN)
                    ? formatSigned(row.maxDrawdown as number, 2, '%')
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  </Paper>
)

export default memo(MonthlyReturnsTable)
