import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import type { PortfolioRegression } from '../../../types'
import { formatSigned } from '../../../formatters'
import SummaryMetricCell from './SummaryMetricCell'

const HelpLabel = ({ label, description }: { label: string; description: string }) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    <Typography variant="subtitle2">{label}</Typography>
    <Tooltip title={description} arrow placement="top">
      <IconButton
        size="small"
        aria-label={`Explain ${label}`}
        sx={{ p: 0.25, color: 'text.secondary' }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  </Stack>
)

const PortfolioRegressionSummary = ({
  regression,
  formatSymbol = (symbol) => symbol,
}: {
  regression: PortfolioRegression | null
  formatSymbol?: (symbol: string) => string
}) => {
  const isRegularized = (regression?.regularization ?? 0) > 0
  const conditionLabel = Number.isFinite(regression?.conditionIndex)
    ? regression?.conditionIndex.toFixed(1)
    : 'unbounded'
  const betaDescription = isRegularized
    ? `Partial sensitivity from the multivariate factor model. The underlying factors overlap strongly (condition index ${conditionLabel}), so ridge stabilization is applied to prevent unstable opposing coefficients. Betas are not bounded to plus or minus one and can still exceed that range for leveraged exposure.`
    : 'Partial sensitivity from the multivariate factor model. A beta of 1 means roughly one-for-one movement while holding the other fitted factors constant. Betas are not bounded to plus or minus one.'

  return (
    <Paper
      component="section"
      aria-label="Factor diagnostics"
      variant="outlined"
      sx={{ overflow: 'hidden' }}
    >
      <Stack sx={{ px: 2, py: 2 }} spacing={0.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Factor diagnostics
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isRegularized ? 'Regularized regression' : 'Regression'} against aligned underlying daily
          returns
        </Typography>
      </Stack>
      {regression ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: '1px',
            backgroundColor: 'divider',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <SummaryMetricCell
            label="Annualized alpha"
            value={formatSigned(regression.alphaAnn, 2, '%')}
            tone={
              regression.alphaAnn > 0
                ? 'positive'
                : regression.alphaAnn < 0
                  ? 'negative'
                  : 'default'
            }
            description="Annualized regression intercept: the return not explained by the aligned underlying factors."
          />
          <SummaryMetricCell
            label="R-squared"
            value={formatSigned(regression.r2, 3)}
            description="Share of portfolio-return variation explained by the fitted underlying factors."
          />
          <SummaryMetricCell
            label="Observations"
            value={String(regression.n)}
            detail="Aligned daily returns"
            description="Number of portfolio days with complete aligned data used in the regression."
          />
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
          Factor diagnostics are unavailable because there is not enough aligned underlying data.
        </Typography>
      )}
      {regression && (
        <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.5}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <HelpLabel label="Factor betas" description={betaDescription} />
            <Typography variant="caption" color="text.secondary">
              {regression.betas.length} fitted factors
              {isRegularized ? ' · collinearity stabilized' : ''}
            </Typography>
          </Stack>
          {regression.betas.length > 0 ? (
            <Box
              component="dl"
              aria-label="Factor betas"
              sx={{
                m: 0,
                mt: 1.25,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
                columnGap: { sm: 2.5 },
              }}
            >
              {regression.betas.map((item) => (
                <Box
                  key={item.symbol}
                  component="div"
                  sx={{
                    minWidth: 0,
                    py: 0.75,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    columnGap: 2,
                    alignItems: 'baseline',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    component="dt"
                    variant="body2"
                    noWrap
                    title={formatSymbol(item.symbol)}
                  >
                    {formatSymbol(item.symbol)}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatSigned(item.beta, 2)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No factor coefficients are available.
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  )
}

export default PortfolioRegressionSummary
