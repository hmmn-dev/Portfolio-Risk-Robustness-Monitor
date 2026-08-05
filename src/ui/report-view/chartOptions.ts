import type { DailyPoint } from '../../engine/types'
import type { ReportChartTheme } from './chartTheme'
import { formatAxisDate } from './formatters'
import { computePadding, ensureStartPoint, fillSeries } from './helpers/chartSeries'

const DAY_MS = 24 * 60 * 60 * 1000
// Preset ranges may begin at the next available observation rather than the exact boundary.
const YEAR_ONLY_AXIS_MIN_SPAN_MS = (3 * 365 - 14) * DAY_MS

const formatAxisYear = (value: number, firstTime?: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const isFirstObservation = value === firstTime
  const isYearBoundary = date.getUTCMonth() === 0 && date.getUTCDate() === 1
  return isFirstObservation || isYearBoundary ? String(date.getUTCFullYear()) : ''
}

const getCalendarTickValues = (start: number, end: number) => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return []

  const startDate = new Date(start)
  let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)
  const ticks = [start]

  while (cursor < end) {
    const date = new Date(cursor)
    ticks.push(cursor)
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  }

  return ticks
}

export const buildLineOptions = ({
  data,
  chartTheme,
  color = chartTheme.primary,
  area = false,
  areaOpacity = 0.14,
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
  hideMinGridline = false,
  showMonthTicks = false,
}: {
  data: DailyPoint[]
  chartTheme: ReportChartTheme
  color?: string
  area?: boolean
  areaOpacity?: number
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
  hideMinGridline?: boolean
  showMonthTicks?: boolean
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
  const resolvedYAxisMin = yAxisMin ?? min - padding - minOffset - gridlineOffset
  const resolvedYAxisMax = yAxisMax ?? max + padding
  const usesTimeAxis = axisType === 'time'
  const finiteTimes = filled.map((point) => point.time).filter((time) => Number.isFinite(time))
  const firstTime = finiteTimes[0]
  const lastTime = finiteTimes[finiteTimes.length - 1]
  const usesYearOnlyLabels =
    usesTimeAxis &&
    firstTime != null &&
    lastTime != null &&
    lastTime - firstTime >= YEAR_ONLY_AXIS_MIN_SPAN_MS
  const calendarTickValues =
    usesYearOnlyLabels && firstTime != null && lastTime != null
      ? getCalendarTickValues(firstTime, lastTime)
      : []
  const yearLabelValues = calendarTickValues.filter(
    (time, index) => index === 0 || new Date(time).getUTCMonth() === 0,
  )
  const timeAxisTickValues = showMonthTicks ? calendarTickValues : yearLabelValues

  const xAxisCommon = {
    boundaryGap: false,
    axisLine: { show: showAxes, lineStyle: { color: chartTheme.axis } },
    axisTick: showAxes
      ? {
          show: true,
          customValues: usesYearOnlyLabels ? timeAxisTickValues : undefined,
          lineStyle:
            usesYearOnlyLabels && showMonthTicks
              ? { color: chartTheme.axis, opacity: 0.6 }
              : undefined,
        }
      : { show: false },
    axisLabel: showAxes
      ? {
          show: true,
          color: chartTheme.label,
          formatter: (value: number | string) =>
            usesYearOnlyLabels
              ? formatAxisYear(Number(value), firstTime)
              : formatAxisDate(Number(value)),
          interval: 'auto',
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true,
          margin: 10,
          fontSize: 11,
          opacity: 1,
          customValues: usesYearOnlyLabels ? yearLabelValues : undefined,
        }
      : { show: false },
    splitLine: { show: false },
    name: showAxes && !usesTimeAxis ? 'Date' : '',
    nameLocation: 'middle',
    nameGap: 30,
    nameTextStyle: { color: chartTheme.label, fontSize: 11 },
  }

  return {
    useUTC: true,
    animation: false,
    grid: usesTimeAxis
      ? { left: 64, right: 16, top: 16, bottom: 44, containLabel: false }
      : { left: 36, right: 16, top: 16, bottom: 40, containLabel: true },
    xAxis:
      axisType === 'time'
        ? {
            type: 'time',
            min: 'dataMin',
            max: 'dataMax',
            splitNumber: 6,
            ...xAxisCommon,
          }
        : {
            type: 'category',
            data: filled.map((point) => point.time),
            ...xAxisCommon,
          },
    yAxis: {
      type: 'value',
      min: resolvedYAxisMin,
      max: resolvedYAxisMax,
      scale: true,
      boundaryGap: yBoundaryGap,
      axisLine: { show: showAxes, lineStyle: { color: chartTheme.axis } },
      axisTick: { show: showAxes },
      axisLabel: showAxes
        ? {
            show: true,
            color: chartTheme.label,
            formatter: yAxisFormatter
              ? (value: number | string) => yAxisFormatter(Number(value))
              : undefined,
            showMinLabel: !hideMinMaxLabels,
            showMaxLabel: !hideMinMaxLabels,
          }
        : { show: false },
      splitLine: showAxes
        ? { showMinLine: !hideMinGridline, lineStyle: { color: chartTheme.grid } }
        : { show: false },
      name: showAxes ? (yAxisName ?? 'Value') : '',
      nameLocation: 'middle',
      nameGap: 46,
      nameTextStyle: { color: chartTheme.label, fontSize: 11 },
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
        areaStyle: area
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color },
                  { offset: 1, color: 'rgba(0, 0, 0, 0)' },
                ],
              },
              opacity: areaOpacity,
            }
          : undefined,
      },
    ],
    tooltip: { show: false },
  }
}

export const buildDrawdownOptions = ({
  data,
  realizedFallback,
  chartTheme,
  yAxisName,
  yAxisFormatter,
}: {
  data: DailyPoint[]
  realizedFallback: DailyPoint[]
  chartTheme: ReportChartTheme
  yAxisName: string
  yAxisFormatter: (value: number) => string
}) => {
  const filled = fillSeries(ensureStartPoint(data))
  const fallbackTimes = new Set(realizedFallback.map((point) => point.time))
  const hasRealizedFallback = filled.some((point) => fallbackTimes.has(point.time))
  const sourceBoundaryTimes = filled.flatMap((point, index) => {
    if (index === 0) return []
    const previousUsesFallback = fallbackTimes.has(filled[index - 1].time)
    const currentUsesFallback = fallbackTimes.has(point.time)
    return previousUsesFallback === currentUsesFallback ? [] : [point.time]
  })
  const primaryValues: Array<number | null> = filled.map((point) =>
    fallbackTimes.has(point.time) ? null : point.value,
  )
  const fallbackValues: Array<number | null> = filled.map((point) =>
    fallbackTimes.has(point.time) ? point.value : null,
  )

  if (hasRealizedFallback) {
    const fallbackBoundarySource = [...fallbackValues]
    fallbackBoundarySource.forEach((value, index) => {
      if (value == null) return
      if (index > 0 && fallbackBoundarySource[index - 1] == null) {
        fallbackValues[index - 1] = filled[index - 1].value
      }
      if (index < fallbackBoundarySource.length - 1 && fallbackBoundarySource[index + 1] == null) {
        fallbackValues[index + 1] = filled[index + 1].value
      }
    })
  }

  const baseOptions = buildLineOptions({
    data,
    chartTheme,
    color: chartTheme.drawdown,
    area: true,
    areaOpacity: chartTheme.areaOpacity,
    showAxes: true,
    smooth: false,
    axisType: 'time',
    yAxisName,
    yAxisFormatter,
    yAxisMax: 0,
  })
  const primarySeries = baseOptions.series[0]
  const sourceBoundaryMarkLine =
    sourceBoundaryTimes.length > 0
      ? {
          silent: true,
          symbol: 'none',
          z: 8,
          label: { show: false },
          lineStyle: {
            color: chartTheme.drawdownBoundary,
            type: 'dashed',
            width: 1,
          },
          data: sourceBoundaryTimes.map((time) => ({ xAxis: time })),
        }
      : undefined
  const series = hasRealizedFallback
    ? [
        {
          ...primarySeries,
          name: 'In-trade DD',
          data: filled.map((point, index) => [point.time, primaryValues[index]]),
          connectNulls: false,
          markLine: sourceBoundaryMarkLine,
        },
        {
          ...primarySeries,
          name: 'Realized DD fallback',
          data: filled.map((point, index) => [point.time, fallbackValues[index]]),
          connectNulls: false,
          markLine: undefined,
          lineStyle: { color: chartTheme.drawdownFallback, width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: chartTheme.drawdownFallback },
                { offset: 1, color: 'rgba(0, 0, 0, 0)' },
              ],
            },
            opacity: chartTheme.areaOpacity,
          },
        },
      ]
    : baseOptions.series

  return {
    ...baseOptions,
    series,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: { dataIndex: number }[]) => {
        const first = params?.[0]
        if (!first) return ''
        const point = filled[first.dataIndex]
        if (!point) return ''
        const date = formatAxisDate(point.time)
        const ddValue = Number.isFinite(point.value) ? `${point.value.toFixed(2)}%` : '-'
        const source = fallbackTimes.has(point.time)
          ? '<br/>Source: Realized DD (candles unavailable for this period)'
          : ''
        return `${date}<br/>DD: ${ddValue}${source}`
      },
    },
  }
}
