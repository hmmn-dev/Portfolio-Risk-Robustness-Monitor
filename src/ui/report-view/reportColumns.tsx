import { Chip } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type { GridColDef } from '@mui/x-data-grid'
import { getSymbolChipStyles } from './colors'
import type { PdfColumn } from './components/PdfTable'
import {
  ShockCell,
  ShockHeader,
  SignedValue,
  StatusCell,
  StatusHeader,
} from './components/ReportGridCells'
import { formatCurrency, formatNumber, formatPercent, formatRate } from './formatters'
import { formatAlphaEvidence, getStatusLabel } from './riskStatusPresentation'
import type { PerformanceRow, RiskRow } from './types'

export const createPerformanceColumns = (theme: Theme): GridColDef[] => {
  const isDark = theme.palette.mode === 'dark'
  const negativeColor = isDark ? theme.palette.error.light : theme.palette.error.dark
  const signed = (value: number | null, formatted: string) => (
    <SignedValue value={value} formatted={formatted} negativeColor={negativeColor} />
  )

  return [
    { field: 'sleeve', headerName: 'Sleeve', flex: 1.2, minWidth: 180 },
    {
      field: 'symbol',
      headerName: 'Symbol',
      flex: 0.8,
      minWidth: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.symbol || '-'}
          sx={getSymbolChipStyles(params.row.symbol as string, isDark)}
        />
      ),
    },
    {
      field: 'totalPnl',
      headerName: 'Total PnL',
      flex: 0.9,
      minWidth: 130,
      renderCell: (params) =>
        signed(
          params.row.totalPnl as number | null,
          formatCurrency(params.row.totalPnl as number | null),
        ),
    },
    {
      field: 'meanAnn',
      headerName: 'Mean ann %',
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) =>
        signed(
          params.row.meanAnn as number | null,
          formatPercent(params.row.meanAnn as number | null, 2),
        ),
    },
    {
      field: 'sharpe',
      headerName: 'Sharpe',
      flex: 0.6,
      minWidth: 110,
      renderCell: (params) =>
        signed(
          params.row.sharpe as number | null,
          formatNumber(params.row.sharpe as number | null, 2),
        ),
    },
    {
      field: 'last2yPnl',
      headerName: 'Last 2Y PnL',
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) =>
        signed(
          params.row.last2yPnl as number | null,
          formatCurrency(params.row.last2yPnl as number | null),
        ),
    },
    {
      field: 'last2yMeanAnn',
      headerName: 'Last 2Y Mean ann %',
      flex: 0.9,
      minWidth: 180,
      renderCell: (params) =>
        signed(
          params.row.last2yMeanAnn as number | null,
          formatPercent(params.row.last2yMeanAnn as number | null, 2),
        ),
    },
    {
      field: 'last2ySharpe',
      headerName: 'Last 2Y Sharpe',
      flex: 0.8,
      minWidth: 150,
      renderCell: (params) =>
        signed(
          params.row.last2ySharpe as number | null,
          formatNumber(params.row.last2ySharpe as number | null, 2),
        ),
    },
  ]
}

export const createRiskColumns = (theme: Theme): GridColDef[] => {
  const isDark = theme.palette.mode === 'dark'
  const negativeColor = isDark ? theme.palette.error.light : theme.palette.error.dark
  const signed = (value: number | null, formatted: string) => (
    <SignedValue value={value} formatted={formatted} negativeColor={negativeColor} />
  )

  return [
    { field: 'sleeve', headerName: 'Sleeve', flex: 1.2, minWidth: 180 },
    {
      field: 'symbol',
      headerName: 'Symbol',
      flex: 0.8,
      minWidth: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.symbol || '-'}
          sx={getSymbolChipStyles(params.row.symbol as string, isDark)}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.6,
      minWidth: 180,
      headerClassName: 'status-header',
      renderHeader: () => <StatusHeader theme={theme} />,
      renderCell: (params) => <StatusCell row={params.row as RiskRow} theme={theme} />,
    },
    {
      field: 'shock',
      headerName: 'Shock',
      flex: 0.6,
      minWidth: 160,
      headerClassName: 'shock-header',
      renderHeader: () => <ShockHeader theme={theme} />,
      renderCell: (params) => <ShockCell value={String(params.row.shock ?? '')} theme={theme} />,
    },
    {
      field: 'alphaPct',
      headerName: 'Alpha pctile',
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) =>
        signed(
          params.row.alphaPct as number | null,
          formatPercent(params.row.alphaPct as number | null, 0),
        ),
    },
    {
      field: 'last1ySharpe',
      headerName: 'Last 1Y Sharpe',
      flex: 0.8,
      minWidth: 150,
      renderCell: (params) =>
        signed(
          params.row.last1ySharpe as number | null,
          formatNumber(params.row.last1ySharpe as number | null, 2),
        ),
    },
    {
      field: 'last2ySharpe',
      headerName: 'Last 2Y Sharpe',
      flex: 0.8,
      minWidth: 150,
      renderCell: (params) =>
        signed(
          params.row.last2ySharpe as number | null,
          formatNumber(params.row.last2ySharpe as number | null, 2),
        ),
    },
    {
      field: 'last2yWinrate',
      headerName: 'Last 2Y Winrate',
      flex: 0.8,
      minWidth: 150,
      renderCell: (params) => formatRate(params.row.last2yWinrate as number | null, 1),
    },
  ]
}

export const PDF_PERFORMANCE_COLUMNS: PdfColumn<PerformanceRow>[] = [
  { header: 'Sleeve', getCell: (row) => ({ text: row.sleeve }) },
  { header: 'Symbol', getCell: (row) => ({ text: row.symbol || '-' }) },
  {
    header: 'Total PnL',
    getCell: (row) => ({
      text: formatCurrency(row.totalPnl),
      negative: row.totalPnl < 0,
      align: 'right',
    }),
  },
  {
    header: 'Mean ann %',
    getCell: (row) => ({
      text: formatPercent(row.meanAnn, 2),
      negative: row.meanAnn < 0,
      align: 'right',
    }),
  },
  {
    header: 'Sharpe',
    getCell: (row) => ({
      text: formatNumber(row.sharpe, 2),
      negative: row.sharpe < 0,
      align: 'right',
    }),
  },
  {
    header: 'Last 2Y PnL',
    getCell: (row) => ({
      text: formatCurrency(row.last2yPnl),
      negative: row.last2yPnl < 0,
      align: 'right',
    }),
  },
  {
    header: 'Last 2Y Mean ann %',
    getCell: (row) => ({
      text: formatPercent(row.last2yMeanAnn, 2),
      negative: row.last2yMeanAnn < 0,
      align: 'right',
    }),
  },
  {
    header: 'Last 2Y Sharpe',
    getCell: (row) => ({
      text: formatNumber(row.last2ySharpe, 2),
      negative: row.last2ySharpe < 0,
      align: 'right',
    }),
  },
]

export const PDF_RISK_COLUMNS: PdfColumn<RiskRow>[] = [
  { header: 'Sleeve', getCell: (row) => ({ text: row.sleeve }) },
  { header: 'Symbol', getCell: (row) => ({ text: row.symbol || '-' }) },
  { header: 'Status', getCell: (row) => ({ text: getStatusLabel(row.status) }) },
  { header: 'Shock', getCell: (row) => ({ text: row.shock || '-' }) },
  {
    header: 'Alpha pctile',
    getCell: (row) => ({
      text: formatPercent(row.alphaPct, 0),
      negative: (row.alphaPct ?? 0) < 0,
      align: 'right',
    }),
  },
  {
    header: 'Alpha support',
    getCell: (row) => ({ text: formatAlphaEvidence(row) }),
  },
  {
    header: 'Last 1Y Sharpe',
    getCell: (row) => ({
      text: formatNumber(row.last1ySharpe, 2),
      negative: (row.last1ySharpe ?? 0) < 0,
      align: 'right',
    }),
  },
  {
    header: 'Last 2Y Sharpe',
    getCell: (row) => ({
      text: formatNumber(row.last2ySharpe, 2),
      negative: (row.last2ySharpe ?? 0) < 0,
      align: 'right',
    }),
  },
  {
    header: 'Last 2Y Winrate',
    getCell: (row) => ({ text: formatRate(row.last2yWinrate, 1), align: 'right' }),
  },
]
