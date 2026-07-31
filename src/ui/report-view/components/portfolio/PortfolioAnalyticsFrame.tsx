import {
  Alert,
  Box,
  CircularProgress,
  Collapse,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import type { PropsWithChildren } from 'react'

type PortfolioAnalyticsFrameProps = PropsWithChildren<{
  refreshing: boolean
}>

const PortfolioAnalyticsFrame = ({ refreshing, children }: PortfolioAnalyticsFrameProps) => (
  <Box component="section" aria-label="Portfolio analytics" aria-busy={refreshing}>
    <Collapse in={refreshing} unmountOnExit>
      <Alert
        role="status"
        aria-live="polite"
        severity="info"
        variant="outlined"
        icon={<CircularProgress size={18} thickness={5} color="inherit" />}
        sx={{ mb: 2, alignItems: 'center' }}
      >
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Refreshing portfolio view
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Updating charts and analytics sections
          </Typography>
          <LinearProgress aria-hidden sx={{ mt: 0.75 }} />
        </Box>
      </Alert>
    </Collapse>
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
