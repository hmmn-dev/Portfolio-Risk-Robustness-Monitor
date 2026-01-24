import { Box, Divider, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

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
      backgroundColor: '#ffffff',
      color: '#101828',
      boxSizing: 'border-box',
    }}
  >
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {pdfName || 'Portfolio Monitoring Report'}
        </Typography>
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
