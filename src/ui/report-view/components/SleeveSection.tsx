import { Paper, Stack, Typography } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import type { DailyPoint, ReportModel } from '../../../engine/types'
import { buildLineOptions, DrawdownChart, EquityChart } from '../charts'
import { formatAxisNumber, formatDrawdownSourceLabel } from '../formatters'

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
  pnlColor,
  axisColor,
  gridColor,
}: {
  item: ReportModel['contributions'][number]
  metrics: SleeveMetrics | null
  showTitle?: boolean
  baseCapital: number
  drawdownSeries: DailyPoint[]
  drawdownSource?: 'H1' | 'D1'
  pnlScaleMode?: 'linear' | 'log'
  pnlColor: string
  axisColor: string
  gridColor: string
}) => {
  const sleeveBaseCapital = Number.isFinite(item.baseCapital)
    ? (item.baseCapital as number)
    : baseCapital

  return (
    <Stack spacing={2}>
      {showTitle && <Typography variant="h6">{item.sleeve}</Typography>}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2">Contribution equity</Typography>
        <EquityChart
          data={item.index ?? []}
          scaleMode="percent"
          pnlScaleMode={pnlScaleMode}
          baseValue={sleeveBaseCapital}
          drawdownSeries={drawdownSeries}
          color={pnlColor}
          axisColor={axisColor}
          gridColor={gridColor}
        />
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2">
          Contribution drawdown ({formatDrawdownSourceLabel(drawdownSource)})
        </Typography>
        <DrawdownChart data={drawdownSeries} axisColor={axisColor} gridColor={gridColor} />
      </Paper>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Alpha (rolling)</Typography>
          {metrics && (
            <ReactECharts
              option={buildLineOptions({
                data: metrics.alphaSeries,
                height: 140,
                color: pnlColor,
                showAxes: true,
                paddingRatio: 0.02,
                axisType: 'category',
                axisColor,
                gridColor,
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
                height: 140,
                color: pnlColor,
                showAxes: true,
                paddingRatio: 0.02,
                axisType: 'category',
                axisColor,
                gridColor,
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
                height: 140,
                color: pnlColor,
                showAxes: true,
                paddingRatio: 0.02,
                axisType: 'category',
                axisColor,
                gridColor,
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
