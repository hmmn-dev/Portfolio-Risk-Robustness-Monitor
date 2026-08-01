import { Backdrop, Box, LinearProgress, Typography } from '@mui/material'

type ProgressBackdropProps = {
  open: boolean
  label: string
  message?: string
  zIndexOffset?: number
  compact?: boolean
}

const ProgressBackdrop = ({
  open,
  label,
  message,
  zIndexOffset = 1,
  compact = false,
}: ProgressBackdropProps) => (
  <Backdrop
    open={open}
    aria-hidden={false}
    sx={(theme) => ({
      color: theme.palette.common.white,
      zIndex: theme.zIndex.drawer + zIndexOffset,
    })}
  >
    <Box
      role="status"
      aria-label={label}
      aria-live="polite"
      sx={{
        width: compact ? { xs: '60%', sm: '40%' } : 'min(400px, calc(100vw - 48px))',
        minWidth: compact ? 160 : 0,
      }}
    >
      {message && (
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {message}
        </Typography>
      )}
      <LinearProgress aria-label={`${label} progress`} />
    </Box>
  </Backdrop>
)

export default ProgressBackdrop
