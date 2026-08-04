import { Box, Paper, Stack, Typography } from '@mui/material'
import { memo, useMemo, useState } from 'react'
import type { DailyPoint, ReportModel } from '../../../../engine/types'
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
            <Typography component="h2" variant="subtitle1">
              Portfolio equity
            </Typography>
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
                aria-label="Realized drawdown fallback"
              >
                <Box
                  component="span"
                  sx={{ width: 18, height: 3, bgcolor: 'warning.dark', flexShrink: 0 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Realized DD where candles are unavailable
                </Typography>
              </Stack>
            )}
          </Stack>
          <DrawdownChart
            data={visibleSeries.drawdown}
            realizedFallback={visibleDrawdownFallback}
            height={drawdownHeight}
          />
        </Box>
      </Stack>
    </Paper>
  )
}

export default memo(PortfolioChartsPanel)
