import { Alert, Box, Chip, Paper, Stack } from '@mui/material'
import { memo } from 'react'
import type { DailyPoint, ReportModel } from '../../../../engine/types'
import { formatDrawdownModeLabel, formatDrawdownSourceLabel, formatSigned } from '../../formatters'
import {
  buildPortfolioSummaryMetrics,
  type PortfolioSummaryMetrics,
} from '../../portfolio/portfolioSummaryMetrics'
import type { DrawdownMode } from '../../reportAnalytics'
import type { PortfolioSummary, RiskRow } from '../../types'
import PortfolioHealthSummary from './summary/PortfolioHealthSummary'
import MetricGrid from './summary/MetricGrid'
import ReportSectionHeader from './summary/ReportSectionHeader'
import SummaryMetricCell, { type MetricTone } from './summary/SummaryMetricCell'

type PortfolioSummaryPanelProps = {
  summary: PortfolioSummary | null
  index: DailyPoint[]
  returns: DailyPoint[]
  drawdown: DailyPoint[]
  drawdownMode: DrawdownMode
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  riskRows: RiskRow[]
  customPortfolio: boolean
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const formatPeriod = (metrics: PortfolioSummaryMetrics) =>
  metrics.startTime != null && metrics.endTime != null
    ? `${dateFormatter.format(metrics.startTime)} to ${dateFormatter.format(metrics.endTime)}`
    : 'Track-record dates unavailable'

const formatStagnation = (days: number) => {
  if (!Number.isFinite(days)) return 'n/a'
  if (days >= 365) return `${(days / 365.25).toFixed(1)}y`
  return `${Math.round(days)}d`
}

const signedTone = (value: number): MetricTone =>
  value > 0 ? 'positive' : value < 0 ? 'negative' : 'default'

const PortfolioSummaryPanel = ({
  summary,
  index,
  returns,
  drawdown,
  drawdownMode,
  drawdownSource,
  riskRows,
  customPortfolio,
}: PortfolioSummaryPanelProps) => {
  const metrics = buildPortfolioSummaryMetrics(summary, index, returns, drawdown)
  const totalReturn = summary?.totalReturnPct ?? Number.NaN
  const cagr = summary?.cagr ?? Number.NaN
  const maxDrawdown = summary?.maxDrawdown ?? Number.NaN
  const mar = summary?.mar ?? Number.NaN
  const sharpe = summary?.sharpe ?? Number.NaN

  return (
    <Paper
      component="section"
      aria-label="Portfolio summary"
      variant="outlined"
      sx={{ overflow: 'hidden' }}
    >
      <ReportSectionHeader
        title="Portfolio summary"
        subtitle="Performance, resilience, and portfolio health at a glance"
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              variant="outlined"
              label={customPortfolio ? 'Custom composition' : 'Baseline portfolio'}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${formatDrawdownModeLabel(drawdownMode)} · ${formatDrawdownSourceLabel(
                drawdownSource,
              )}`}
            />
          </Stack>
        }
      />

      {customPortfolio && (
        <Alert severity="info" variant="outlined" sx={{ mx: 2.5, mb: 2 }}>
          Results use the selected sleeve series and weights and may differ from jointly traded
          portfolio performance.
        </Alert>
      )}

      <MetricGrid
        columns={{
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'minmax(280px, 1.4fr) repeat(3, minmax(0, 1fr))',
        }}
      >
        <Box sx={{ gridColumn: { sm: '1 / -1', lg: 'auto' }, gridRow: { lg: 'span 2' } }}>
          <SummaryMetricCell
            featured
            label="Total return"
            value={formatSigned(totalReturn, 2, '%')}
            tone={signedTone(totalReturn)}
            detail={`${formatPeriod(metrics)} · ${metrics.tradingDays} trading days`}
            description="Compounded portfolio return over the displayed track record."
          />
        </Box>
        <SummaryMetricCell
          label="CAGR"
          value={formatSigned(cagr, 2, '%')}
          tone={signedTone(cagr)}
          description="Compound annual growth rate: the constant annual rate that links the first and last portfolio index values."
        />
        <SummaryMetricCell
          label="Max drawdown"
          value={formatSigned(maxDrawdown, 2, '%')}
          tone={maxDrawdown < 0 ? 'negative' : 'default'}
          description="Largest peak-to-trough percentage decline in the selected drawdown series."
        />
        <SummaryMetricCell
          label="Current drawdown"
          value={formatSigned(metrics.currentDrawdown, 2, '%')}
          tone={metrics.currentDrawdown < 0 ? 'negative' : 'default'}
          description="Latest percentage distance below the high-water mark in the selected drawdown series."
        />
        <SummaryMetricCell
          label="MAR ratio"
          value={formatSigned(mar, 2)}
          tone={signedTone(mar)}
          description="CAGR divided by the absolute maximum drawdown. Higher positive values indicate more annualized growth per unit of drawdown."
        />
        <SummaryMetricCell
          label="Sharpe ratio"
          value={formatSigned(sharpe, 2)}
          tone={signedTone(sharpe)}
          description="Annualized mean daily portfolio return divided by daily return volatility, with no risk-free-rate adjustment."
        />
        <SummaryMetricCell
          label="Recovery factor"
          value={formatSigned(metrics.recoveryFactor, 2)}
          tone={signedTone(metrics.recoveryFactor)}
          description="Total return divided by the absolute maximum drawdown. It measures cumulative return relative to the worst loss from a peak."
        />
      </MetricGrid>

      <Box
        component="section"
        aria-label="Track-record quality"
        sx={{ borderTop: 1, borderColor: 'divider' }}
      >
        <ReportSectionHeader
          title="Track-record quality"
          subtitle="Consistency and recovery characteristics of the daily return series"
          headingComponent="h3"
        />
        <MetricGrid
          columns={{
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(5, minmax(0, 1fr))',
          }}
        >
          <SummaryMetricCell
            label="Daily SQN"
            value={formatSigned(metrics.dailySqn, 2)}
            tone={signedTone(metrics.dailySqn)}
            description="SQN-style score calculated as square root of N times mean daily return divided by sample standard deviation. This is a daily-return measure, not trade-level SQN based on R-multiples."
          />
          <SummaryMetricCell
            label="Profitable days"
            value={formatSigned(metrics.profitableDaysPct, 1, '%')}
            description="Percentage of finite daily portfolio returns that are greater than zero."
          />
          <SummaryMetricCell
            label="Longest stagnation"
            value={formatStagnation(metrics.stagnationDays)}
            description="Longest elapsed period from a portfolio high-water mark until that level was recovered, including an ongoing unrecovered period."
          />
          <SummaryMetricCell
            label="High-water return"
            value={formatSigned(metrics.highWaterReturnPct, 2, '%')}
            tone={signedTone(metrics.highWaterReturnPct)}
            description="Highest compounded portfolio return reached relative to the starting index value."
          />
          <SummaryMetricCell
            label="Trading days"
            value={String(metrics.tradingDays)}
            description="Number of finite daily portfolio index observations in the displayed track record."
          />
        </MetricGrid>
      </Box>

      <PortfolioHealthSummary riskRows={riskRows} drawdown={drawdown} />
    </Paper>
  )
}

export default memo(PortfolioSummaryPanel)
