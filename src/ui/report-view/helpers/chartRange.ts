import type { DailyPoint } from '../../../engine/types'

export type ChartRangePreset = 'all' | '5y' | '3y' | '1y'

export type ChartRangeSelection =
  | { type: 'preset'; preset: ChartRangePreset }
  | { type: 'custom'; startTime: number; endTime: number }

export type ChartRangeBounds = {
  minTime: number
  maxTime: number
}

export const ALL_CHART_RANGE: ChartRangeSelection = { type: 'preset', preset: 'all' }

const RANGE_YEARS: Record<Exclude<ChartRangePreset, 'all'>, number> = {
  '5y': 5,
  '3y': 3,
  '1y': 1,
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const utcDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const utcDayEnd = (timestamp: number) => utcDayStart(timestamp) + 24 * 60 * 60 * 1000 - 1

const subtractUtcYears = (timestamp: number, years: number) => {
  const end = new Date(timestamp)
  const targetYear = end.getUTCFullYear() - years
  const targetMonth = end.getUTCMonth()
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return Date.UTC(targetYear, targetMonth, Math.min(end.getUTCDate(), lastDayOfTargetMonth))
}

export const getChartRangeBounds = (...series: DailyPoint[][]): ChartRangeBounds | null => {
  let minTime = Number.POSITIVE_INFINITY
  let maxTime = Number.NEGATIVE_INFINITY

  series.forEach((points) => {
    points.forEach((point) => {
      if (!Number.isFinite(point.time)) return
      minTime = Math.min(minTime, point.time)
      maxTime = Math.max(maxTime, point.time)
    })
  })

  return Number.isFinite(minTime) && Number.isFinite(maxTime) ? { minTime, maxTime } : null
}

export const resolveChartRange = (
  bounds: ChartRangeBounds | null,
  selection: ChartRangeSelection,
): ChartRangeBounds | null => {
  if (!bounds) return null
  if (selection.type === 'preset') {
    return {
      minTime:
        selection.preset === 'all'
          ? bounds.minTime
          : Math.max(
              bounds.minTime,
              subtractUtcYears(bounds.maxTime, RANGE_YEARS[selection.preset]),
            ),
      maxTime: bounds.maxTime,
    }
  }

  const firstSelectedDate = Math.min(selection.startTime, selection.endTime)
  const lastSelectedDate = Math.max(selection.startTime, selection.endTime)
  const first = clamp(utcDayStart(firstSelectedDate), bounds.minTime, bounds.maxTime)
  const second = clamp(utcDayEnd(lastSelectedDate), bounds.minTime, bounds.maxTime)
  return {
    minTime: first,
    maxTime: second,
  }
}

export const filterSeriesByRange = (
  series: DailyPoint[],
  range: ChartRangeBounds | null,
): DailyPoint[] => {
  if (!range) return []
  return series.filter(
    (point) =>
      Number.isFinite(point.time) && point.time >= range.minTime && point.time <= range.maxTime,
  )
}

export const filterEquityAndDrawdownRange = (
  equity: DailyPoint[],
  drawdown: DailyPoint[],
  selection: ChartRangeSelection | ChartRangePreset,
) => {
  const normalizedSelection: ChartRangeSelection =
    typeof selection === 'string' ? { type: 'preset', preset: selection } : selection
  if (normalizedSelection.type === 'preset' && normalizedSelection.preset === 'all') {
    return { equity, drawdown }
  }

  const range = resolveChartRange(getChartRangeBounds(equity, drawdown), normalizedSelection)
  return {
    equity: filterSeriesByRange(equity, range),
    drawdown: filterSeriesByRange(drawdown, range),
  }
}

export const formatDateInputValue = (timestamp: number) => {
  if (!Number.isFinite(timestamp)) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export const parseDateInputValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && formatDateInputValue(timestamp) === value ? timestamp : null
}
