import { alpha, type Theme } from '@mui/material/styles'

export type ReportChartTheme = {
  primary: string
  drawdown: string
  axis: string
  grid: string
  label: string
  areaOpacity: number
}

export const getReportChartTheme = (theme: Theme): ReportChartTheme => ({
  primary: theme.palette.primary.main,
  drawdown: theme.palette.error.main,
  axis: alpha(theme.palette.text.primary, 0.45),
  grid: alpha(theme.palette.text.primary, 0.12),
  label: theme.palette.text.secondary,
  areaOpacity: theme.palette.mode === 'light' ? 0.09 : 0.14,
})
