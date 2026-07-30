import { Box, CssBaseline, ThemeProvider } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type { RefObject } from 'react'
import ReportPdf from './ReportPdf'

type ReportPdfRendererProps = {
  visible: boolean
  theme: Theme
  width: number
  containerRef: RefObject<HTMLDivElement | null>
}

const ReportPdfRenderer = ({ visible, theme, width, containerRef }: ReportPdfRendererProps) => {
  if (!visible) return null

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        ref={containerRef}
        sx={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width,
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <ReportPdf />
      </Box>
    </ThemeProvider>
  )
}

export default ReportPdfRenderer
