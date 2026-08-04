import { Paper, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { useMemo, useState } from 'react'
import type { DailyPoint, ReportModel } from '../../../engine/types'
import { buildLineOptions } from '../chartOptions'
import { getReportChartTheme } from '../chartTheme'
import { DrawdownChart, EquityChart } from '../charts'
import { formatAxisNumber, formatDrawdownSourceLabel } from '../formatters'
import {
  ALL_CHART_RANGE,
  filterEquityAndDrawdownRange,
  getChartRangeBounds,
  type ChartRangeSelection,
} from '../helpers/chartRange'
import ChartRangeSelector from './ChartRangeSelector'

export type SleeveMetrics = {
  alphaSeries: DailyPoint[]
  alphaBounds: { min: number; max: number }
  sharpeSeries: DailyPoint[]
  sharpeBounds: { min: number; max: number }
  winrateSeries: DailyPoint[]
}

const SleeveSection = ({
  item,
  metrics,
  showTitle = true,
  baseCapital,
  drawdownSeries,
  drawdownSource,
  pnlScaleMode = 'linear',
}: {
  item: ReportModel['contributions'][number]
  metrics: SleeveMetrics | null
  showTitle?: boolean
  baseCapital: number
  drawdownSeries: DailyPoint[]
  drawdownSource?: 'H1' | 'D1'
  pnlScaleMode?: 'linear' | 'log'
}) => {
  const chartTheme = getReportChartTheme(useTheme())
  const sleeveBaseCapital = Number.isFinite(item.baseCapital)
    ? (item.baseCapital as number)
    : baseCapital
  const [range, setRange] = useState<ChartRangeSelection>(ALL_CHART_RANGE)
  const rangeBounds = useMemo(
    () => getChartRangeBounds(item.index ?? [], drawdownSeries),
    [drawdownSeries, item.index],
  )
  const visibleSeries = useMemo(
    () => filterEquityAndDrawdownRange(item.index ?? [], drawdownSeries, range),
    [drawdownSeries, item.index, range],
  )

  return (
    <Stack spacing={2}>
      {showTitle && <Typography variant="h6">{item.sleeve}</Typography>}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">Contribution equity</Typography>
          <ChartRangeSelector
            value={range}
            bounds={rangeBounds}
            onChange={setRange}
            ariaLabel={`${item.sleeve} equity date range`}
          />
        </Stack>
        <EquityChart
          data={visibleSeries.equity}
          scaleMode="percent"
          pnlScaleMode={pnlScaleMode}
          baseValue={sleeveBaseCapital}
          drawdownSeries={visibleSeries.drawdown}
        />
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2">
          Contribution drawdown ({formatDrawdownSourceLabel(drawdownSource)})
        </Typography>
        <DrawdownChart data={visibleSeries.drawdown} />
      </Paper>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Alpha (rolling)</Typography>
          {metrics && (
            <ReactECharts
              option={buildLineOptions({
                data: metrics.alphaSeries,
                chartTheme,
                showAxes: true,
                paddingRatio: 0.02,
                axisType: 'category',
                yAxisMin: metrics.alphaBounds.min,
                yAxisMax: metrics.alphaBounds.max,
                yAxisName: 'Alpha %',
                yAxisFormatter: (value: number) => `${formatAxisNumber(value, 2)}%`,
                hideMinMaxLabels: true,
              })}
              style={{ height: 140 }}
              lazyUpdate
            />
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Sharpe (rolling)</Typography>
          {metrics && (
            <ReactECharts
              option={buildLineOptions({
                data: metrics.sharpeSeries,
                chartTheme,
                showAxes: true,
                paddingRatio: 0.02,
                axisType: 'category',
                yAxisMin: metrics.sharpeBounds.min,
                yAxisMax: metrics.sharpeBounds.max,
                yAxisName: 'Sharpe',
                yAxisFormatter: (value: number) => formatAxisNumber(value, 2),
                hideMinMaxLabels: true,
              })}
              style={{ height: 140 }}
              lazyUpdate
            />
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Winrate (rolling)</Typography>
          {metrics && (
            <ReactECharts
              option={buildLineOptions({
                data: metrics.winrateSeries,
                chartTheme,
                showAxes: true,
                paddingRatio: 0.02,
                axisType: 'category',
                yAxisMin: 0,
                yAxisMax: 1,
                yAxisFormatter: (value: number) => `${Math.round(value * 100)}%`,
                yAxisName: 'Winrate %',
              })}
              style={{ height: 140 }}
              lazyUpdate
            />
          )}
        </Paper>
      </Stack>
    </Stack>
  )
}

export default SleeveSection
