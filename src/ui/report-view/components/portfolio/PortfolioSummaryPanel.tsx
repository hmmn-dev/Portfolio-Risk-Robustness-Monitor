import { Alert, Box, Paper, Stack, Typography } from '@mui/material'
import { computeDdShock } from '../../../../engine/ddShock'
import type { DailyPoint, ReportModel } from '../../../../engine/types'
import { formatDrawdownModeLabel, formatDrawdownSourceLabel, formatSigned } from '../../formatters'
import type { DrawdownMode } from '../../reportAnalytics'
import type { PortfolioSummary, RiskRow } from '../../types'

const SummaryMetric = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
      {label}
    </Typography>
    <Typography variant="h6">{value}</Typography>
  </Box>
)

type PortfolioSummaryPanelProps = {
  summary: PortfolioSummary | null
  drawdown: DailyPoint[]
  drawdownMode: DrawdownMode
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  riskRows: RiskRow[]
  customPortfolio: boolean
  formatSymbol?: (symbol: string) => string
}

const PortfolioSummaryPanel = ({
  summary,
  drawdown,
  drawdownMode,
  drawdownSource,
  riskRows,
  customPortfolio,
  formatSymbol = (symbol) => symbol,
}: PortfolioSummaryPanelProps) => (
  <Paper variant="outlined" sx={{ p: 3 }}>
    <Stack spacing={2.5}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Portfolio summary
      </Typography>
      {customPortfolio && (
        <Alert severity="info" variant="outlined">
          Results are based on the selected sleeve series and weights. They may differ from the
          performance you would see if those sleeves were traded together.
        </Alert>
      )}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} flexWrap="wrap">
        <SummaryMetric
          label="PnL %"
          value={formatSigned(summary?.totalReturnPct ?? Number.NaN, 2, '%')}
        />
        <SummaryMetric label="CAGR %" value={formatSigned(summary?.cagr ?? Number.NaN, 2, '%')} />
        <SummaryMetric
          label={`Max DD % (${formatDrawdownModeLabel(drawdownMode)}, ${formatDrawdownSourceLabel(
            drawdownSource,
          )})`}
          value={formatSigned(summary?.maxDrawdown ?? Number.NaN, 2, '%')}
        />
        <SummaryMetric label="MAR ratio" value={formatSigned(summary?.mar ?? Number.NaN, 2)} />
        <SummaryMetric label="Sharpe" value={formatSigned(summary?.sharpe ?? Number.NaN, 2)} />
      </Stack>
      {summary?.regression && (
        <Box>
          <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
            Portfolio regression (n={summary.regression.n})
          </Typography>
          <Typography variant="body1" color="text.primary">
            alpha_ann={formatSigned(summary.regression.alphaAnn, 2, '%/yr')}; betas:{' '}
            {summary.regression.betas
              .map((item) => `${formatSymbol(item.symbol)}: ${formatSigned(item.beta, 2)}`)
              .join(', ')}
          </Typography>
          <Typography variant="body1" color="text.primary">
            R²={formatSigned(summary.regression.r2, 3)}
          </Typography>
        </Box>
      )}
      <Box>
        <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
          Status counts
        </Typography>
        <Typography variant="body1" color="text.primary">
          GREEN={riskRows.filter((row) => row.status === 'GREEN').length}, YELLOW=
          {riskRows.filter((row) => row.status === 'YELLOW').length}, RED=
          {riskRows.filter((row) => row.status === 'RED').length}
        </Typography>
      </Box>
      <Box>
        <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
          Portfolio DD shock flag
        </Typography>
        <Typography variant="body1" color="text.primary">
          {computeDdShock(drawdown).flag}
        </Typography>
      </Box>
    </Stack>
  </Paper>
)

export default PortfolioSummaryPanel
