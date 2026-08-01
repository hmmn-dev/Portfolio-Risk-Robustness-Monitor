import { createAppTheme } from '../../theme'

export const REPORT_PRINT_THEME = createAppTheme('light')

export const REPORT_PRINT_COLORS = {
  canvasBackground: '#ffffff',
  pageBackground: '#ffffff',
  pageText: '#101828',
  tableBorder: '#d6d6d6',
  tableHeaderBackground: '#f2f4f7',
  tableHeaderText: '#344054',
  negative: '#b42318',
} as const
