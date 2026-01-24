import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useMemo } from 'react'
import AppShell from './ui/AppShell'
import ReportView from './ui/report-view/ReportView'
import Wizard from './ui/Wizard'
import { useReportStore } from './store/report'
import { useUIStore } from './store/ui'
import { appBackgroundStyles, createAppTheme } from './theme'

const HomeRedirect = () => {
  const report = useReportStore((state) => state.report)
  const hasHydrated = useReportStore((state) => state.hasHydrated)
  if (!hasHydrated) return null
  return <Navigate to={report ? '/report' : '/wizard'} replace />
}

const ReportRoute = () => {
  const report = useReportStore((state) => state.report)
  const hasHydrated = useReportStore((state) => state.hasHydrated)
  if (!hasHydrated) return null
  return report ? <ReportView /> : <Navigate to="/wizard" replace />
}

const WizardRoute = () => {
  const report = useReportStore((state) => state.report)
  const hasHydrated = useReportStore((state) => state.hasHydrated)
  if (!hasHydrated) return null
  return report ? <Navigate to="/report" replace /> : <Wizard />
}

function App() {
  const colorMode = useUIStore((state) => state.colorMode)
  const theme = useMemo(() => createAppTheme(colorMode), [colorMode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={appBackgroundStyles(colorMode)} />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/wizard" element={<WizardRoute />} />
            <Route path="/report" element={<ReportRoute />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
