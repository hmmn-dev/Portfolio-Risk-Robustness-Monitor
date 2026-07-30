import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import type { RiskRow } from '../types'

const LegendHelp = ({ children, maxWidth }: { children: ReactNode; maxWidth: number }) => (
  <Tooltip
    placement="top"
    slotProps={{ tooltip: { sx: { maxWidth } } }}
    title={<Box sx={{ p: 1, maxWidth }}>{children}</Box>}
  >
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.secondary' }}
    >
      <HelpOutlineOutlinedIcon fontSize="small" />
    </Box>
  </Tooltip>
)

const LegendChip = ({ label, color, theme }: { label: string; color: string; theme: Theme }) => (
  <Chip
    size="small"
    label={label}
    sx={{ backgroundColor: color, color: theme.palette.getContrastText(color) }}
  />
)

const RiskMetric = ({
  label,
  value,
  emphasized,
  color,
}: {
  label: string
  value: string
  emphasized: boolean
  color: string
}) => (
  <Typography
    variant="caption"
    sx={{
      display: 'block',
      color: emphasized ? color : 'inherit',
      fontWeight: emphasized ? 700 : 400,
    }}
  >
    • {label} {value}
  </Typography>
)

export const SignedValue = ({
  value,
  formatted,
  negativeColor,
}: {
  value: number | null
  formatted: string
  negativeColor: string
}) => (
  <Box component="span" sx={{ color: value != null && value < 0 ? negativeColor : 'inherit' }}>
    {formatted}
  </Box>
)

export const StatusHeader = ({ theme }: { theme: Theme }) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      Status
    </Typography>
    <LegendHelp maxWidth={600}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
        Status Legend
      </Typography>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LegendChip label="GREEN" color={theme.palette.success.main} theme={theme} />
          <Typography variant="caption">
            <strong>Alpha pctile</strong> {'\u2265'} 40 and <strong>2Y Sharpe</strong> {'>'} 0.5
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <LegendChip label="YELLOW" color={theme.palette.warning.dark} theme={theme} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            <strong>Alpha pctile</strong> {'<'} 40 or <strong>1Y Sharpe</strong> {'<'} 0 or
            <strong> DD shock</strong> ORANGE
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <LegendChip label="RED" color={theme.palette.error.dark} theme={theme} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            <strong>DD shock</strong> RED or <strong>Overall Sharpe</strong> {'<'} 0
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <LegendChip label="SHOCK" color={theme.palette.warning.dark} theme={theme} />
          <Typography variant="caption">
            ORANGE downgrades GREEN → YELLOW; RED forces RED
          </Typography>
        </Stack>
      </Stack>
    </LegendHelp>
  </Stack>
)

export const ShockHeader = ({ theme }: { theme: Theme }) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      Shock
    </Typography>
    <LegendHelp maxWidth={360}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
        DD Shock Logic
      </Typography>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LegendChip label="ORANGE" color={theme.palette.warning.main} theme={theme} />
          <Typography variant="caption">Downgrades GREEN → YELLOW</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <LegendChip label="RED" color={theme.palette.error.main} theme={theme} />
          <Typography variant="caption">Forces RED status</Typography>
        </Stack>
        <Typography variant="caption">
          Based on last <strong>63 trading days</strong> of drawdown magnitude.
        </Typography>
        <Typography variant="caption">
          <strong>ORANGE</strong> when <strong>last-window DD</strong> is ≥ <strong>1.5×</strong>{' '}
          prior max DD, or ≥ <strong>5%</strong> if no prior DD.
        </Typography>
        <Typography variant="caption">
          <strong>RED</strong> when <strong>last-window DD</strong> is ≥ <strong>2.0×</strong> prior
          max DD.
        </Typography>
      </Stack>
    </LegendHelp>
  </Stack>
)

export const StatusCell = ({ row, theme }: { row: RiskRow; theme: Theme }) => {
  const statusColor =
    row.status === 'GREEN'
      ? theme.palette.success.main
      : row.status === 'YELLOW'
        ? theme.palette.warning.dark
        : row.status === 'RED'
          ? theme.palette.error.dark
          : theme.palette.grey[600]
  const severityColor =
    row.status === 'RED'
      ? theme.palette.error.light
      : row.status === 'YELLOW' || row.shock === 'ORANGE'
        ? theme.palette.warning.light
        : theme.palette.error.light
  const metrics = [
    {
      label: 'alpha pctile',
      value: row.alphaPct != null ? `${Math.round(row.alphaPct)}%` : 'n/a',
      emphasized: row.alphaPct == null || row.alphaPct < 40,
    },
    {
      label: 'winrate pctile',
      value: row.winratePctile != null ? `${Math.round(row.winratePctile)}%` : 'n/a',
      emphasized: row.winratePctile != null && row.winratePctile < 20,
    },
    {
      label: 'last 1Y sharpe',
      value: row.last1ySharpe != null ? row.last1ySharpe.toFixed(2) : 'n/a',
      emphasized: row.last1ySharpe != null && row.last1ySharpe < 0,
    },
    {
      label: 'last 2Y sharpe',
      value: row.last2ySharpe != null ? row.last2ySharpe.toFixed(2) : 'n/a',
      emphasized: row.last2ySharpe != null && row.last2ySharpe < 0,
    },
    {
      label: 'overall sharpe',
      value: row.overallSharpe != null ? row.overallSharpe.toFixed(2) : 'n/a',
      emphasized: row.overallSharpe != null && row.overallSharpe < 0,
    },
    {
      label: 'last 2Y winrate',
      value: row.last2yWinrate != null ? `${Math.round(row.last2yWinrate * 100)}%` : 'n/a',
      emphasized: false,
    },
  ]
  if (row.shock !== 'NONE') {
    metrics.push({
      label: 'dd shock',
      value: row.shock,
      emphasized: row.shock === 'RED' || row.shock === 'ORANGE',
    })
  }

  return (
    <Tooltip
      placement="top"
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
            Reasons
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {row.statusReasons || 'n/a'}
          </Typography>
          {metrics.map((metric) => (
            <RiskMetric key={metric.label} {...metric} color={severityColor} />
          ))}
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mt: 0.5 }}>
            Action
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {row.statusAction || 'n/a'}
          </Typography>
        </Box>
      }
    >
      <Chip
        size="small"
        label={row.status || '-'}
        sx={{
          backgroundColor: statusColor,
          color: theme.palette.getContrastText(statusColor),
          fontWeight: 500,
          borderColor: statusColor,
        }}
      />
    </Tooltip>
  )
}

export const ShockCell = ({ value, theme }: { value: string; theme: Theme }) => {
  const color =
    value === 'NONE'
      ? theme.palette.grey[600]
      : value === 'ORANGE'
        ? theme.palette.warning.main
        : value === 'RED'
          ? theme.palette.error.main
          : theme.palette.grey[600]

  return (
    <Chip
      size="small"
      label={value || '-'}
      sx={{
        backgroundColor: color,
        color: theme.palette.getContrastText(color),
        fontWeight: value === 'YELLOW' || value === 'RED' ? 700 : 600,
        borderColor: color,
      }}
    />
  )
}
