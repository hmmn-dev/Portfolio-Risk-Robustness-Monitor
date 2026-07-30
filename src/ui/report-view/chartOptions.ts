import type { DailyPoint } from '../../engine/types'
import { formatAxisDate } from './formatters'
import { computePadding, ensureStartPoint, fillSeries } from './helpers'

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
      name: showAxes ? (yAxisName ?? 'Value') : '',
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
