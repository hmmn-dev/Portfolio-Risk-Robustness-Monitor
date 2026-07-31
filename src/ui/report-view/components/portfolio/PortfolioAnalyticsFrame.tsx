import { Box, CircularProgress, Snackbar, Stack } from '@mui/material'
import type { PropsWithChildren } from 'react'

type PortfolioAnalyticsFrameProps = PropsWithChildren<{
  refreshing: boolean
}>

const PortfolioAnalyticsFrame = ({ refreshing, children }: PortfolioAnalyticsFrameProps) => (
  <Box component="section" aria-label="Portfolio analytics" aria-busy={refreshing}>
    <Snackbar
      open={refreshing}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message={
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress aria-hidden size={18} thickness={5} color="inherit" />
          <span>Refreshing charts and portfolio analytics</span>
        </Stack>
      }
      slotProps={{ content: { role: 'status', 'aria-live': 'polite' } }}
      sx={{ pointerEvents: 'none' }}
    />
    <Stack
      spacing={2}
      sx={(theme) => ({
        opacity: refreshing ? 0.52 : 1,
        transition: theme.transitions.create('opacity', {
          duration: theme.transitions.duration.shorter,
        }),
      })}
    >
      {children}
    </Stack>
  </Box>
)

export default PortfolioAnalyticsFrame
