import { Box, Divider, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { REPORT_PRINT_COLORS } from '../printTheme'

const PdfPage = ({
  title,
  pdfName,
  width,
  minHeight,
  children,
}: {
  title: string
  pdfName: string
  width: number
  minHeight: number
  children: ReactNode
}) => (
  <Box
    data-pdf-page
    sx={{
      width,
      minHeight,
      p: 4,
      backgroundColor: REPORT_PRINT_COLORS.pageBackground,
      color: REPORT_PRINT_COLORS.pageText,
      boxSizing: 'border-box',
    }}
  >
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">{pdfName || 'Portfolio Monitoring Tool'}</Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Divider />
      {children}
    </Stack>
  </Box>
)

export default PdfPage
