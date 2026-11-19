import { Box, Paper, Stack, Typography } from '@mui/material'
import { memo, useMemo, useState } from 'react'
import type { DailyPoint, ReportModel, PortfolioEquitySource } from '../../../../engine/types'
import { DrawdownChart, EquityChart } from '../../charts'
import { formatDrawdownSourceLabel } from '../../formatters'
import {
  ALL_CHART_RANGE,
  filterEquityAndDrawdownRange,
  filterSeriesByRange,
  getChartRangeBounds,
  resolveChartRange,
  type ChartRangeSelection,
} from '../../helpers/chartRange'
import ChartRangeSelector from '../ChartRangeSelector'

type PortfolioChartsPanelProps = {
  equitySource?: PortfolioEquitySource
  equityExposureMultiplier?: number
  index: DailyPoint[]
  drawdown: DailyPoint[]
  drawdownFallback?: DailyPoint[]
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  pnlScaleMode: 'linear' | 'log'
  baseCapital: number
  equityHeight?: number
  drawdownHeight?: number
  showRangeSelector?: boolean
  rangeSelection?: ChartRangeSelection
  onRangeSelectionChange?: (selection: ChartRangeSelection) => void
}

const PortfolioChartsPanel = ({
  index,
  equitySource,
  equityExposureMultiplier,
  drawdown,
  drawdownFallback = [],
  drawdownSource,
  pnlScaleMode,
  baseCapital,
  equityHeight = 360,
  drawdownHeight = 200,
  showRangeSelector = true,
  rangeSelection,
  onRangeSelectionChange,
}: PortfolioChartsPanelProps) => {
  const [internalRange, setInternalRange] = useState<ChartRangeSelection>(ALL_CHART_RANGE)
  const range = rangeSelection ?? internalRange
  const onRangeChange = onRangeSelectionChange ?? setInternalRange
  const rangeBounds = useMemo(() => getChartRangeBounds(index, drawdown), [drawdown, index])
  const visibleSeries = useMemo(
    () =>
      filterEquityAndDrawdownRange(index, drawdown, showRangeSelector ? range : ALL_CHART_RANGE),
    [drawdown, index, range, showRangeSelector],
  )
  const visibleDrawdownFallback = useMemo(() => {
    const selection = showRangeSelector ? range : ALL_CHART_RANGE
    if (selection.type === 'preset' && selection.preset === 'all') return drawdownFallback
    return filterSeriesByRange(drawdownFallback, resolveChartRange(rangeBounds, selection))
  }, [drawdownFallback, range, rangeBounds, showRangeSelector])

  const recordedFallback =
    equitySource === 'deal-snapshots' || equitySource?.startsWith('recorded+')
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography component="h2" variant="subtitle1">
                {equitySource ? 'Portfolio equity' : 'Portfolio balance'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {equityExposureMultiplier != null
                  ? `Simulated equity · ${equityExposureMultiplier.toFixed(2)}× baseline equity returns`
                  : equitySource === 'deal-snapshots'
                  ? 'Recorded account equity · deal-time snapshots; moves between deals are not captured'
                  : equitySource?.startsWith('recorded+')
                    ? `Recorded account equity · ${equitySource.slice(9)} estimates fill missing ${equitySource === 'recorded+H1' ? 'hours' : equitySource === 'recorded+D1' ? 'days' : 'periods'}`
                    : equitySource
                      ? `Estimated equity · ${equitySource} candle closes${drawdownFallback.length ? '; realized balance outside available pricing' : ''}`
                      : 'Realized balance · excludes open-position PnL'}
              </Typography>
            </Box>
            {showRangeSelector && (
              <ChartRangeSelector
                value={range}
                bounds={rangeBounds}
                onChange={onRangeChange}
                ariaLabel="Portfolio equity date range"
              />
            )}
          </Stack>
          <EquityChart
            data={visibleSeries.equity}
            scaleMode="percent"
            pnlScaleMode={pnlScaleMode}
            baseValue={baseCapital}
            drawdownSeries={visibleSeries.drawdown}
            height={equityHeight}
            minOffsetRatio={0}
            reserveGridlines={0}
          />
        </Box>
        <Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.75}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography component="h2" variant="subtitle1">
              Portfolio drawdown ({formatDrawdownSourceLabel(drawdownSource)})
            </Typography>
            {visibleDrawdownFallback.length > 0 && (
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                aria-label={
                  recordedFallback ? 'Recorded equity only' : 'Realized drawdown fallback'
                }
              >
                <Box
                  component="span"
                  sx={{ width: 18, height: 3, bgcolor: 'warning.dark', flexShrink: 0 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {recordedFallback
                    ? `${equityExposureMultiplier != null ? 'Snapshot-based returns' : 'Recorded equity'} · outside candle-covered days`
                    : 'Realized DD where candles are unavailable'}
                </Typography>
              </Stack>
            )}
          </Stack>
          <DrawdownChart
            data={visibleSeries.drawdown}
            realizedFallback={visibleDrawdownFallback}
            fallbackSource={recordedFallback ? 'recorded' : 'realized'}
            height={drawdownHeight}
          />
        </Box>
      </Stack>
    </Paper>
  )
}

export default memo(PortfolioChartsPanel)
