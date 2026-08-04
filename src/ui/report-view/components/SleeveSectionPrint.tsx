import { Paper, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { DailyPoint, ReportModel } from '../../../engine/types'
import { buildLineOptions } from '../chartOptions'
import { getReportChartTheme } from '../chartTheme'
import { DrawdownChart, EquityChart } from '../charts'
import { formatAxisNumber, formatDrawdownSourceLabel } from '../formatters'
import type { SleeveMetrics } from './SleeveSection'

const SleeveSectionPrint = ({
  item,
  metrics,
  baseCapital,
  drawdownSeries,
  drawdownSource,
  pnlScaleMode = 'linear',
}: {
  item: ReportModel['contributions'][number]
  metrics: SleeveMetrics
  baseCapital: number
  drawdownSeries: DailyPoint[]
  drawdownSource?: 'H1' | 'D1'
  pnlScaleMode?: 'linear' | 'log'
}) => {
  const chartTheme = getReportChartTheme(useTheme())
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
        />
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2">
          Contribution drawdown ({formatDrawdownSourceLabel(drawdownSource)})
        </Typography>
        <DrawdownChart data={drawdownSeries} />
      </Paper>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2">Alpha (rolling)</Typography>
          <ReactECharts
            option={buildLineOptions({
              data: metrics.alphaSeries,
              chartTheme,
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
              chartTheme,
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
              chartTheme,
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
