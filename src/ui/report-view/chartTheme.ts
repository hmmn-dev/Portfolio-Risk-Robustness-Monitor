import { alpha, type Theme } from '@mui/material/styles'

export type ReportChartTheme = {
  primary: string
  drawdown: string
  drawdownFallback: string
  drawdownBoundary: string
  axis: string
  grid: string
  label: string
  areaOpacity: number
}

export const getReportChartTheme = (theme: Theme): ReportChartTheme => ({
  primary: theme.palette.primary.main,
  drawdown: theme.palette.error.main,
  drawdownFallback: theme.palette.warning.dark,
  drawdownBoundary: alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.26 : 0.38),
  axis: alpha(theme.palette.text.primary, 0.45),
  grid: alpha(theme.palette.text.primary, 0.12),
  label: theme.palette.text.secondary,
  areaOpacity: theme.palette.mode === 'light' ? 0.09 : 0.14,
})
