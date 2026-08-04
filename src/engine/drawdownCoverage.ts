import { stableSort } from './stableSort'
import type { DailyPoint } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

const toUtcDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export type ResolvedDrawdownCoverage = {
  drawdown: DailyPoint[]
  realizedFallback: DailyPoint[]
}

const sortFiniteTimes = (series: DailyPoint[]) =>
  stableSort(
    series.filter((point) => Number.isFinite(point.time)),
    (left, right) => left.time - right.time,
  )

export const resolveMtmDrawdownCoverage = (
  realizedDrawdown: DailyPoint[],
  mtmDrawdown: DailyPoint[],
): ResolvedDrawdownCoverage => {
  const realized = sortFiniteTimes(realizedDrawdown)
  const mtm = sortFiniteTimes(mtmDrawdown)

  if (realized.length === 0) {
    return { drawdown: mtm, realizedFallback: [] }
  }

  const portfolioStart = toUtcDayStart(realized[0].time)
  const portfolioEnd = toUtcDayStart(realized.at(-1)?.time ?? portfolioStart) + DAY_MS - 1
  const clippedMtm = mtm.filter(
    (point) => point.time >= portfolioStart && point.time <= portfolioEnd,
  )

  if (clippedMtm.length === 0) {
    return { drawdown: realized, realizedFallback: realized }
  }

  const coverageStart = clippedMtm[0].time
  const coverageEnd = clippedMtm.at(-1)?.time ?? coverageStart
  const realizedFallback = realized.filter(
    (point) => point.time < coverageStart || point.time > coverageEnd,
  )

  return {
    drawdown: stableSort([...clippedMtm, ...realizedFallback], (left, right) => {
      return left.time - right.time
    }),
    realizedFallback,
  }
}
