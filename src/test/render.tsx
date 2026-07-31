import { ThemeProvider } from '@mui/material/styles'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createAppTheme } from '../theme'

export const renderWithTheme = (ui: ReactElement) =>
  render(
    <ThemeProvider theme={createAppTheme('light')}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>
    </ThemeProvider>,
  )
