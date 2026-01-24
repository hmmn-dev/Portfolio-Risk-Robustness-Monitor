import { Paper, Stack, Typography } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import type { DailyPoint, ReportModel } from '../../../engine/types'
import { buildLineOptions, DrawdownChart, EquityChart } from '../charts'
import { formatAxisNumber, formatDrawdownSourceLabel } from '../formatters'
import type { SleeveMetrics } from './SleeveSection'

const SleeveSectionPrint = ({
  item,
  metrics,
  baseCapital,
  drawdownSeries,
  drawdownSource,
  pnlScaleMode = 'linear',
  pnlColor,
  axisColor,
  gridColor,
}: {
  item: ReportModel['contributions'][number]
  metrics: SleeveMetrics
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
          <ReactECharts
            option={buildLineOptions({
              data: metrics.alphaSeries,
              height: 140,
              color: pnlColor,
              axisColor,
              gridColor,
              yAxisName: 'Alpha %',
              yAxisFormatter: (value) => `${value.toFixed(2)}%`,
              yAxisMin: metrics.alphaBounds.min,
              yAxisMax: metrics.alphaBounds.max,
              hideMinMaxLabels: true,
            })}
            style={{ height: 140 }}
          />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Sharpe (rolling)</Typography>
          <ReactECharts
            option={buildLineOptions({
              data: metrics.sharpeSeries,
              height: 140,
              color: pnlColor,
              axisColor,
              gridColor,
              yAxisName: 'Sharpe',
              yAxisMin: metrics.sharpeBounds.min,
              yAxisMax: metrics.sharpeBounds.max,
              yAxisFormatter: (value) => formatAxisNumber(value, 2),
              hideMinMaxLabels: true,
            })}
            style={{ height: 140 }}
          />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Winrate (rolling)</Typography>
          <ReactECharts
            option={buildLineOptions({
              data: metrics.winrateSeries,
              height: 140,
              color: pnlColor,
              axisColor,
              gridColor,
              yAxisName: 'Winrate %',
              yAxisMin: 0,
              yAxisMax: 1,
              yAxisFormatter: (value) => `${Math.round(value * 100)}%`,
            })}
            style={{ height: 140 }}
          />
        </Paper>
      </Stack>
    </Stack>
  )
}

export default SleeveSectionPrint
