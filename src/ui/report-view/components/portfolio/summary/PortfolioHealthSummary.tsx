import { Box, Stack, Typography } from '@mui/material'
import { computeDdShock } from '../../../../../engine/ddShock'
import type { DailyPoint } from '../../../../../engine/types'
import { buildPortfolioStatusCounts } from '../../../portfolio/portfolioSummaryMetrics'
import type { RiskRow } from '../../../types'
import SummaryMetricCell, { type MetricTone } from './SummaryMetricCell'

const countDetail = (count: number, total: number) =>
  total > 0 ? `${Math.round((count / total) * 100)}% of ${total} sleeves` : 'No sleeve statuses'

const PortfolioHealthSummary = ({
  riskRows,
  drawdown,
}: {
  riskRows: RiskRow[]
  drawdown: DailyPoint[]
}) => {
  const counts = buildPortfolioStatusCounts(riskRows)
  const shock = computeDdShock(drawdown)
  const shockView: { value: string; detail: string; tone: MetricTone } =
    shock.flag === 'RED'
      ? {
          value: 'Severe',
          detail: 'Recent drawdown is at least 2x the prior maximum',
          tone: 'negative',
        }
      : shock.flag === 'ORANGE'
        ? {
            value: 'Elevated',
            detail: 'Recent drawdown is at least 1.5x the prior maximum',
            tone: 'warning',
          }
        : {
            value: 'No shock',
            detail: 'No unusual drawdown acceleration detected',
            tone: 'positive',
          }

  return (
    <Box
      component="section"
      aria-label="Portfolio health"
      sx={{ borderTop: 1, borderColor: 'divider' }}
    >
      <Stack sx={{ px: 2.5, pt: 2.5, pb: 1.5 }} spacing={0.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Portfolio health
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Sleeve status distribution and current drawdown shock
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: '1px',
          backgroundColor: 'divider',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <SummaryMetricCell
          label="Healthy"
          value={String(counts.green)}
          detail={countDetail(counts.green, counts.total)}
          tone="positive"
          description="Sleeves whose combined risk and decay rules currently resolve to GREEN."
        />
        <SummaryMetricCell
          label="Review"
          value={String(counts.yellow)}
          detail={countDetail(counts.yellow, counts.total)}
          tone="warning"
          description="Sleeves whose combined risk and decay rules currently resolve to YELLOW and should be reviewed."
        />
        <SummaryMetricCell
          label="Critical"
          value={String(counts.red)}
          detail={countDetail(counts.red, counts.total)}
          tone="negative"
          description="Sleeves whose combined risk and decay rules currently resolve to RED and require action."
        />
        <SummaryMetricCell
          label="DD shock"
          value={shockView.value}
          detail={shockView.detail}
          tone={shockView.tone}
          description="Compares the worst drawdown in the latest 63 observations with the previous maximum. Elevated starts at 1.5x and severe at 2x; a 5% minimum applies when no prior drawdown exists."
        />
      </Box>
      {counts.unknown > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 2.5, py: 1 }}
        >
          {counts.unknown} sleeve status {counts.unknown === 1 ? 'is' : 'are'} unknown.
        </Typography>
      )}
    </Box>
  )
}

export default PortfolioHealthSummary
