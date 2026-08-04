import type { DailyPoint } from '../../engine/types'
import type { ReportChartTheme } from './chartTheme'
import { formatAxisDate } from './formatters'
import { computePadding, ensureStartPoint, fillSeries } from './helpers/chartSeries'

export const buildLineOptions = ({
  data,
  chartTheme,
  height = 160,
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
}: {
  data: DailyPoint[]
  chartTheme: ReportChartTheme
  height?: number
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
    axisLine: { show: showAxes, lineStyle: { color: chartTheme.axis } },
    axisTick: { show: showAxes },
    axisLabel: showAxes
      ? {
          show: true,
          color: chartTheme.label,
          formatter: (value: number | string) => formatAxisDate(Number(value)),
          interval: 'auto',
        }
      : { show: false },
    splitLine: { show: false },
    name: showAxes ? 'Date' : '',
    nameLocation: 'middle',
    nameGap: 30,
    nameTextStyle: { color: chartTheme.label, fontSize: 11 },
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
      splitLine: showAxes ? { lineStyle: { color: chartTheme.grid } } : { show: false },
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
    height,
  }
}

export const buildDrawdownOptions = ({
  data,
  realizedFallback,
  chartTheme,
  height,
  yAxisName,
  yAxisFormatter,
}: {
  data: DailyPoint[]
  realizedFallback: DailyPoint[]
  chartTheme: ReportChartTheme
  height: number
  yAxisName: string
  yAxisFormatter: (value: number) => string
}) => {
  const filled = fillSeries(ensureStartPoint(data))
  const fallbackTimes = new Set(realizedFallback.map((point) => point.time))
  const hasRealizedFallback = filled.some((point) => fallbackTimes.has(point.time))
  const sourceBoundaryIndices = filled.flatMap((point, index) => {
    if (index === 0) return []
    const previousUsesFallback = fallbackTimes.has(filled[index - 1].time)
    const currentUsesFallback = fallbackTimes.has(point.time)
    return previousUsesFallback === currentUsesFallback ? [] : [index]
  })
  const primaryValues: Array<number | null> = filled.map((point) =>
    fallbackTimes.has(point.time) ? null : point.value,
  )
  const fallbackValues: Array<number | null> = filled.map((point) =>
    fallbackTimes.has(point.time) ? point.value : null,
  )

  if (hasRealizedFallback) {
    fallbackValues.forEach((value, index) => {
      if (value == null) return
      if (index > 0 && fallbackValues[index - 1] == null) {
        fallbackValues[index - 1] = filled[index - 1].value
      }
      if (index < fallbackValues.length - 1 && fallbackValues[index + 1] == null) {
        fallbackValues[index + 1] = filled[index + 1].value
      }
    })
  }

  const baseOptions = buildLineOptions({
    data,
    chartTheme,
    height,
    color: chartTheme.drawdown,
    area: true,
    areaOpacity: chartTheme.areaOpacity,
    showAxes: true,
    smooth: false,
    axisType: 'category',
    yAxisName,
    yAxisFormatter,
    yAxisMax: 0,
  })
  const primarySeries = baseOptions.series[0]
  const series = hasRealizedFallback
    ? [
        {
          ...primarySeries,
          name: 'In-trade DD',
          data: primaryValues,
          connectNulls: false,
          markLine:
            sourceBoundaryIndices.length > 0
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
                  data: sourceBoundaryIndices.map((index) => ({ xAxis: index })),
                }
              : undefined,
        },
        {
          ...primarySeries,
          name: 'Realized DD fallback',
          data: fallbackValues,
          connectNulls: false,
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
