import type { DailyPoint } from '../../../engine/types'

export const getSeriesValues = (points: DailyPoint[]) => points.map((point) => point.value)

export const normalizeDay = (timestamp: number) => {
  const normalized = timestamp > 1e12 ? timestamp : timestamp * 1000
  const date = new Date(normalized)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export const buildReturnMap = (series: { time: number; return: number }[]) => {
  const map = new Map<number, number>()
  series.forEach((point) => {
    if (Number.isFinite(point.return)) {
      map.set(normalizeDay(point.time), point.return)
    }
  })
  return map
}

export const alignPairsByDay = (points: DailyPoint[], returnsMap: Map<number, number>) => {
  const xs: number[] = []
  const ys: number[] = []
  const times: number[] = []
  let validCount = 0
  const oneDayMs = 24 * 60 * 60 * 1000
  points.forEach((point) => {
    const key = normalizeDay(point.time)
    let underlyingReturn = returnsMap.get(key)
    if (!Number.isFinite(underlyingReturn)) {
      const prev = returnsMap.get(key - oneDayMs)
      const next = returnsMap.get(key + oneDayMs)
      if (Number.isFinite(prev) && Number.isFinite(next)) {
        underlyingReturn = prev
      } else if (Number.isFinite(prev)) {
        underlyingReturn = prev
      } else if (Number.isFinite(next)) {
        underlyingReturn = next
      }
    }
    const x = Number.isFinite(underlyingReturn) ? (underlyingReturn as number) : Number.NaN
    const y = Number.isFinite(point.value) ? point.value : Number.NaN
    xs.push(x)
    ys.push(y)
    times.push(point.time)
    if (Number.isFinite(x) && Number.isFinite(y)) validCount += 1
  })
  return { xs, ys, times, validCount }
}

export const getLastFinite = (values: number[]) => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index]
  }
  return Number.NaN
}

export const computeSharpe = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return Number.NaN
  const mean = finite.reduce((total, value) => total + value, 0) / finite.length
  const variance =
    finite.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / finite.length
  const stdev = variance > 0 ? Math.sqrt(variance) : 0
  return stdev === 0 ? Number.NaN : (mean / stdev) * Math.sqrt(252)
}

export const computeMean = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return Number.NaN
  return finite.reduce((total, value) => total + value, 0) / finite.length
}

export const sumFinite = (values: number[]) =>
  values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)

export const computeWinrate = (values: number[], eps = 1e-8) => {
  const active = values.filter((value) => Math.abs(value) > eps)
  if (active.length === 0) return Number.NaN
  return active.filter((value) => value > 0).length / active.length
}

export const sanitizeSeries = (values: number[]) =>
  values.map((value) => (Number.isFinite(value) ? value : 0))

export const resolveBaseCapital = (days: { equity: number; pnl: number }[], fallback = 10000) => {
  const first = days.find((day) => Number.isFinite(day.equity) && Number.isFinite(day.pnl))
  if (!first) return fallback
  const base = first.equity - first.pnl
  return Number.isFinite(base) && base > 0 ? base : fallback
}
