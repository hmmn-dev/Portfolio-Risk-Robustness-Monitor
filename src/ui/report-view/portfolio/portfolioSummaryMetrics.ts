import { stableSort } from '../../../engine/stableSort'
import type { DailyPoint } from '../../../engine/types'
import type { PortfolioSummary, RiskRow } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

const finitePoints = (points: DailyPoint[]) =>
  stableSort(
    points.filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value)),
    (left, right) => left.time - right.time,
  )

export const computeDailySqn = (returns: DailyPoint[]) => {
  const values = returns.map((point) => point.value).filter((value) => Number.isFinite(value))
  if (values.length < 2) return Number.NaN

  const mean = values.reduce((total, value) => total + value, 0) / values.length
  const sampleVariance =
    values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / (values.length - 1)
  const standardDeviation = Math.sqrt(sampleVariance)

  return standardDeviation > 0 ? (Math.sqrt(values.length) * mean) / standardDeviation : Number.NaN
}

export const computeLongestStagnationDays = (index: DailyPoint[]) => {
  const points = finitePoints(index)
  if (points.length < 2) return 0

  let highWater = points[0].value
  let highWaterTime = points[0].time
  let underwaterSince: number | null = null
  let longestDuration = 0

  points.slice(1).forEach((point) => {
    if (point.value >= highWater) {
      if (underwaterSince != null) {
        longestDuration = Math.max(longestDuration, point.time - underwaterSince)
      }
      highWater = point.value
      highWaterTime = point.time
      underwaterSince = null
    } else if (underwaterSince == null) {
      underwaterSince = highWaterTime
    }
  })

  if (underwaterSince != null) {
    const lastPoint = points[points.length - 1]
    longestDuration = Math.max(longestDuration, lastPoint.time - underwaterSince)
  }

  return Math.max(0, Math.round(longestDuration / DAY_MS))
}

export type PortfolioSummaryMetrics = {
  currentDrawdown: number
  dailySqn: number
  profitableDaysPct: number
  highWaterReturnPct: number
  recoveryFactor: number
  stagnationDays: number
  tradingDays: number
  startTime?: number
  endTime?: number
}

export const buildPortfolioSummaryMetrics = (
  summary: PortfolioSummary | null,
  index: DailyPoint[],
  returns: DailyPoint[],
  drawdown: DailyPoint[],
): PortfolioSummaryMetrics => {
  const indexPoints = finitePoints(index)
  const drawdownPoints = finitePoints(drawdown)
  const finiteReturns = returns.filter((point) => Number.isFinite(point.value))
  const highWater = indexPoints.reduce(
    (maximum, point) => Math.max(maximum, point.value),
    Number.NEGATIVE_INFINITY,
  )
  const startingIndex = indexPoints[0]?.value ?? Number.NaN
  const profitableDays = finiteReturns.filter((point) => point.value > 0).length
  const maxDrawdown = summary?.maxDrawdown ?? Number.NaN

  return {
    currentDrawdown: drawdownPoints.at(-1)?.value ?? Number.NaN,
    dailySqn: computeDailySqn(returns),
    profitableDaysPct:
      finiteReturns.length > 0 ? (profitableDays / finiteReturns.length) * 100 : Number.NaN,
    highWaterReturnPct:
      Number.isFinite(highWater) && startingIndex > 0
        ? (highWater / startingIndex - 1) * 100
        : Number.NaN,
    recoveryFactor:
      summary && Number.isFinite(summary.totalReturnPct) && maxDrawdown < 0
        ? summary.totalReturnPct / Math.abs(maxDrawdown)
        : Number.NaN,
    stagnationDays: computeLongestStagnationDays(index),
    tradingDays: indexPoints.length,
    startTime: indexPoints[0]?.time,
    endTime: indexPoints.at(-1)?.time,
  }
}

export type PortfolioStatusCounts = {
  green: number
  yellow: number
  red: number
  unknown: number
  total: number
}

export const buildPortfolioStatusCounts = (riskRows: RiskRow[]): PortfolioStatusCounts => {
  const counts = { green: 0, yellow: 0, red: 0, unknown: 0, total: riskRows.length }
  riskRows.forEach((row) => {
    if (row.status === 'GREEN') counts.green += 1
    else if (row.status === 'YELLOW') counts.yellow += 1
    else if (row.status === 'RED') counts.red += 1
    else counts.unknown += 1
  })
  return counts
}
