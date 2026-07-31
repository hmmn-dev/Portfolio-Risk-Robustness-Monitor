import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

export type MetricTone = 'default' | 'positive' | 'negative' | 'warning'

type SummaryMetricCellProps = {
  label: string
  value: string
  description?: string
  detail?: string
  tone?: MetricTone
  featured?: boolean
}

const SummaryMetricCell = ({
  label,
  value,
  description,
  detail,
  tone = 'default',
  featured = false,
}: SummaryMetricCellProps) => {
  const theme = useTheme()
  const toneColor =
    tone === 'positive'
      ? theme.palette.success.main
      : tone === 'negative'
        ? theme.palette.error.main
        : tone === 'warning'
          ? theme.palette.warning.main
          : theme.palette.text.primary

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: featured ? 190 : 96,
        p: featured ? { xs: 2.25, sm: 2.75 } : 1.75,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: featured ? 'center' : 'space-between',
        gap: featured ? 1.5 : 0.75,
        backgroundColor: theme.palette.background.paper,
        borderTop: `2px solid ${featured ? theme.palette.primary.main : alpha(toneColor, 0.5)}`,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" minWidth={0}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}
        >
          {label}
        </Typography>
        {description && (
          <Tooltip title={description} arrow placement="top">
            <IconButton
              size="small"
              aria-label={`Explain ${label}`}
              sx={{ p: 0.25, color: 'text.secondary' }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography
        component="div"
        sx={{
          color: toneColor,
          fontWeight: 750,
          fontVariantNumeric: 'tabular-nums',
          fontSize: featured ? { xs: '2.15rem', sm: '2.75rem' } : '1.35rem',
          lineHeight: 1.1,
          overflowWrap: 'anywhere',
          letterSpacing: 0,
        }}
      >
        {value}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
          {detail}
        </Typography>
      )}
    </Box>
  )
}

export default SummaryMetricCell
