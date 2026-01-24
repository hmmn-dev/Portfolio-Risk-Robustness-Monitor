import ReactECharts from 'echarts-for-react'
import type { DailyPoint } from '../../engine/types'
import { computePadding, ensureStartPoint, fillSeries } from './helpers'
import { formatAxisDate } from './formatters'

export const buildLineOptions = ({
  data,
  height = 160,
  color,
  area = false,
  showAxes = true,
  paddingRatio = 0.08,
  minPadding = 0,
  minClamp = 1,
  includeZero = false,
  smooth = true,
  axisType = 'category',
  step,
  enforceStartValue,
  yBoundaryGap,
  minOffsetRatio = 0,
  reserveGridlines = 0,
  yAxisFormatter,
  yAxisName,
  yAxisMin,
  yAxisMax,
  hideMinMaxLabels = false,
  axisColor = 'rgba(27,59,95,0.35)',
  gridColor = 'rgba(27,59,95,0.12)',
}: {
  data: DailyPoint[]
  height?: number
  color: string
  area?: boolean
  showAxes?: boolean
  paddingRatio?: number
  minPadding?: number
  minClamp?: number
  includeZero?: boolean
  smooth?: boolean
  axisType?: 'category' | 'time'
  step?: 'start' | 'middle' | 'end'
  enforceStartValue?: number
  yBoundaryGap?: [string, string]
  minOffsetRatio?: number
  reserveGridlines?: number
  yAxisFormatter?: (value: number) => string
  yAxisName?: string
  yAxisMin?: number
  yAxisMax?: number
  hideMinMaxLabels?: boolean
  axisColor?: string
  gridColor?: string
}) => {
  const sorted = ensureStartPoint(data)
  const filled = fillSeries(sorted)
  if (Number.isFinite(enforceStartValue) && filled.length > 0) {
    filled[0] = { ...filled[0], value: enforceStartValue as number }
  }
  const values = filled.map((point) => point.value).filter((value) => Number.isFinite(value))
  let min = values.length ? Math.min(...values) : 0
  let max = values.length ? Math.max(...values) : 1
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  const padding = computePadding(min, max, paddingRatio, minPadding, minClamp)
  const range = max - min
  const minOffset = range > 0 ? range * minOffsetRatio : 0
  const gridlineOffset = range > 0 ? (range / 6) * reserveGridlines : 0

  const xAxisCommon = {
    boundaryGap: false,
    axisLine: { show: showAxes, lineStyle: { color: axisColor } },
    axisTick: { show: showAxes },
    axisLabel: showAxes
      ? {
          show: true,
          color: '#5c5f5a',
          formatter: (value: number | string) => formatAxisDate(Number(value)),
          interval: 'auto',
        }
      : { show: false },
    splitLine: { show: false },
    name: showAxes ? 'Date' : '',
    nameLocation: 'middle',
    nameGap: 30,
    nameTextStyle: { color: '#5c5f5a', fontSize: 11 },
  }

  return {
    animation: false,
    grid: { left: 36, right: 16, top: 16, bottom: 40, containLabel: true },
    xAxis:
      axisType === 'time'
        ? {
            type: 'time',
            min: 'dataMin',
            max: 'dataMax',
            ...xAxisCommon,
          }
        : {
            type: 'category',
            data: filled.map((point) => point.time),
            ...xAxisCommon,
          },
    yAxis: {
      type: 'value',
      min: yAxisMin ?? min - padding - minOffset - gridlineOffset,
      max: yAxisMax ?? max + padding,
      scale: true,
      boundaryGap: yBoundaryGap,
      axisLine: { show: showAxes, lineStyle: { color: axisColor } },
      axisTick: { show: showAxes },
      axisLabel: showAxes
        ? {
            show: true,
            color: '#5c5f5a',
            formatter: yAxisFormatter
              ? (value: number | string) => yAxisFormatter(Number(value))
              : undefined,
            showMinLabel: !hideMinMaxLabels,
            showMaxLabel: !hideMinMaxLabels,
          }
        : { show: false },
      splitLine: showAxes ? { lineStyle: { color: gridColor } } : { show: false },
      name: showAxes ? yAxisName ?? 'Value' : '',
      nameLocation: 'middle',
      nameGap: 46,
      nameTextStyle: { color: '#5c5f5a', fontSize: 11 },
    },
    series: [
      {
        type: 'line',
        data:
          axisType === 'time'
            ? filled.map((point) => [point.time, point.value])
            : filled.map((point) => point.value),
        smooth,
        step,
        symbol: 'none',
        connectNulls: true,
        sampling: 'none',
        progressive: 0,
        large: false,
        lineStyle: { color, width: 2 },
        areaStyle: area ? { color, opacity: 0.15 } : undefined,
      },
    ],
    tooltip: { show: false },
    height,
  }
}

export const EquityChart = ({
  data,
  height = 240,
  minOffsetRatio = 0,
  reserveGridlines = 0,
  baseValue,
  scaleMode = 'index',
  pnlScaleMode = 'linear',
  drawdownSeries,
  color,
  axisColor,
  gridColor,
}: {
  data: DailyPoint[]
  height?: number
  minOffsetRatio?: number
  reserveGridlines?: number
  baseValue?: number
  scaleMode?: 'index' | 'currency' | 'percent'
  pnlScaleMode?: 'linear' | 'log'
  drawdownSeries?: DailyPoint[]
  color: string
  axisColor: string
  gridColor: string
}) => {
  const base = Number.isFinite(baseValue) ? (baseValue as number) : 10000
  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const displaySeries =
    scaleMode === 'currency'
      ? data.map((point) => ({ time: point.time, value: point.value }))
      : scaleMode === 'percent'
        ? data.map((point) => ({
            time: point.time,
            value: (point.value - 1) * 100,
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
          value: point.value * base,
        }))
  const chartSeries =
    pnlScaleMode === 'log'
      ? equitySeries.map((point) => ({
          time: point.time,
          value:
            Number.isFinite(point.value) && point.value > 0 ? Math.log(point.value) : Number.NaN,
        }))
      : displaySeries
  const percentValues =
    scaleMode === 'percent'
      ? displaySeries.map((point) => Math.abs(point.value)).filter((value) => Number.isFinite(value))
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
    const equity = Math.exp(value)
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
          height,
          color,
          area: false,
          showAxes: true,
          paddingRatio: 0.02,
          minClamp: pnlScaleMode === 'log' ? 0 : 1,
          smooth: false,
          axisType: 'category',
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
          axisColor,
          gridColor,
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
  height = 160,
  axisColor,
  gridColor,
  yAxisName = 'Drawdown %',
  yAxisFormatter,
}: {
  data: DailyPoint[]
  height?: number
  axisColor: string
  gridColor: string
  yAxisName?: string
  yAxisFormatter?: (value: number) => string
}) => {
  const filled = fillSeries(ensureStartPoint(data))
  return (
    <ReactECharts
      option={{
        ...buildLineOptions({
          data,
          height,
          color: '#c0392b',
          showAxes: true,
          smooth: false,
          axisType: 'category',
          yAxisName,
          yAxisFormatter: yAxisFormatter ?? ((value) => `${value.toFixed(1)}%`),
          yAxisMax: 0,
          axisColor,
          gridColor,
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
            const ddValue = Number.isFinite(point.value) ? `${point.value.toFixed(2)}%` : '-'
            return `${date}<br/>DD: ${ddValue}`
          },
        },
      }}
      style={{ height }}
    />
  )
}
