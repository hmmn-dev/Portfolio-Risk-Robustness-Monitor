import ReactECharts from 'echarts-for-react'
import { useTheme } from '@mui/material/styles'
import type { DailyPoint } from '../../engine/types'
import { buildDrawdownOptions, buildLineOptions } from './chartOptions'
import { getReportChartTheme } from './chartTheme'
import { formatAxisDate } from './formatters'
import { ensureStartPoint, fillSeries } from './helpers/chartSeries'

export const EquityChart = ({
  data,
  height = 240,
  minOffsetRatio = 0,
  reserveGridlines = 0,
  baseValue,
  scaleMode = 'index',
  pnlScaleMode = 'linear',
  drawdownSeries,
}: {
  data: DailyPoint[]
  height?: number
  minOffsetRatio?: number
  reserveGridlines?: number
  baseValue?: number
  scaleMode?: 'index' | 'currency' | 'percent'
  pnlScaleMode?: 'linear' | 'log'
  drawdownSeries?: DailyPoint[]
}) => {
  const theme = useTheme()
  const chartTheme = getReportChartTheme(theme)
  const base =
    Number.isFinite(baseValue) && (baseValue as number) > 0 ? (baseValue as number) : 10000
  const percentBaseline =
    scaleMode === 'percent'
      ? (data.find((point) => Number.isFinite(point.value) && point.value > 0)?.value ?? 1)
      : 1
  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const displaySeries =
    scaleMode === 'currency'
      ? data.map((point) => ({ time: point.time, value: point.value }))
      : scaleMode === 'percent'
        ? data.map((point) => ({
            time: point.time,
            value: (point.value / percentBaseline - 1) * 100,
          }))
        : data.map((point) => ({
            time: point.time,
            value: point.value * base,
          }))
  const equitySeries =
    scaleMode === 'currency'
      ? data.map((point) => ({
          time: point.time,
          value: point.value,
        }))
      : data.map((point) => ({
          time: point.time,
          value: (scaleMode === 'percent' ? point.value / percentBaseline : point.value) * base,
        }))
  const chartSeries =
    pnlScaleMode === 'log'
      ? equitySeries.map((point) => ({
          time: point.time,
          value:
            Number.isFinite(point.value) && point.value > 0
              ? Math.log(point.value / base)
              : Number.NaN,
        }))
      : displaySeries
  const percentValues =
    scaleMode === 'percent'
      ? displaySeries
          .map((point) => Math.abs(point.value))
          .filter((value) => Number.isFinite(value))
      : []
  const percentMax = percentValues.length ? Math.max(...percentValues) : 0
  const percentDigits = percentMax < 1 ? 2 : percentMax < 10 ? 1 : 0
  const formatPercent = (value: number) => `${value.toFixed(percentDigits)}%`
  const formatPercentAxis = (value: number) => `${value.toFixed(percentDigits)}`
  const filled = fillSeries(ensureStartPoint(displaySeries))
  const resolvedDrawdown = drawdownSeries ? fillSeries(ensureStartPoint(drawdownSeries)) : []
  const getDrawdownAt = (time: number) => {
    if (!resolvedDrawdown.length) return Number.NaN
    let low = 0
    let high = resolvedDrawdown.length - 1
    if (time <= resolvedDrawdown[low].time) return resolvedDrawdown[low].value
    if (time >= resolvedDrawdown[high].time) return resolvedDrawdown[high].value
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = resolvedDrawdown[mid].time
      if (midTime === time) return resolvedDrawdown[mid].value
      if (midTime < time) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return resolvedDrawdown[Math.max(0, high)].value
  }
  const logAxisFormatter = (value: number) => {
    const equity = Math.exp(value) * base
    if (scaleMode === 'percent') {
      const percentValue = (equity / base - 1) * 100
      return formatPercentAxis(percentValue)
    }
    return formatCurrency(equity)
  }
  return (
    <ReactECharts
      option={{
        ...buildLineOptions({
          data: chartSeries,
          chartTheme,
          area: true,
          areaOpacity: chartTheme.areaOpacity,
          showAxes: true,
          paddingRatio: 0.02,
          minClamp: pnlScaleMode === 'log' ? 0 : 1,
          smooth: false,
          step: 'end',
          axisType: 'time',
          minOffsetRatio,
          reserveGridlines,
          yAxisName:
            scaleMode === 'percent'
              ? `PnL %${pnlScaleMode === 'log' ? ' (log)' : ''}`
              : `Equity${pnlScaleMode === 'log' ? ' (log)' : ''}`,
          yAxisFormatter:
            pnlScaleMode === 'log'
              ? logAxisFormatter
              : scaleMode === 'percent'
                ? formatPercentAxis
                : formatCurrency,
          hideMinMaxLabels: true,
          hideMinGridline: true,
          showMonthTicks: true,
        }),
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'line' },
          formatter: (params: { dataIndex: number }[]) => {
            const first = params?.[0]
            if (!first) return ''
            const idx = first.dataIndex
            const point = filled[idx]
            if (!point) return ''
            const date = formatAxisDate(point.time)
            const pnlValue =
              scaleMode === 'percent' ? formatPercent(point.value) : formatCurrency(point.value)
            const ddAt = getDrawdownAt(point.time)
            const ddValue = Number.isFinite(ddAt) ? `${ddAt.toFixed(2)}%` : '-'
            return `${date}<br/>PnL: ${pnlValue}<br/>DD: ${ddValue}`
          },
        },
      }}
      style={{ height }}
    />
  )
}

export const DrawdownChart = ({
  data,
  realizedFallback = [],
  height = 160,
  yAxisName = 'Drawdown %',
  yAxisFormatter,
}: {
  data: DailyPoint[]
  realizedFallback?: DailyPoint[]
  height?: number
  yAxisName?: string
  yAxisFormatter?: (value: number) => string
}) => {
  const theme = useTheme()
  const chartTheme = getReportChartTheme(theme)
  return (
    <ReactECharts
      replaceMerge="series"
      option={buildDrawdownOptions({
        data,
        realizedFallback,
        chartTheme,
        yAxisName,
        yAxisFormatter: yAxisFormatter ?? ((value) => `${value.toFixed(1)}%`),
      })}
      style={{ height }}
    />
  )
}
