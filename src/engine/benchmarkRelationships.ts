import { correlation } from './correlation'
import { toDayStart } from './portfolioSeriesHelpers'
import { computeMonthlyReturns } from './returnMetrics'
import { stableSort } from './stableSort'
import type { DailyPoint } from './types'

export type RelationshipFrequency = 'daily' | 'monthly'

export type BenchmarkRelationship = {
  beta: number | null
  correlation: number | null
  observations: number
}

const dailyMap = (points: DailyPoint[]) => {
  const result = new Map<number, number>()
  for (const point of stableSort(points, (a, b) => a.time - b.time)) {
    if (!Number.isFinite(point.time) || !Number.isFinite(new Date(point.time).getTime())) continue
    result.set(toDayStart(point.time), point.value)
  }
  return result
}

export const benchmarkRelationship = (
  target: DailyPoint[],
  benchmark: DailyPoint[],
  frequency: RelationshipFrequency,
): BenchmarkRelationship => {
  const targetMap = dailyMap(target)
  const benchmarkMap = dailyMap(benchmark)
  const targetTimes = Array.from(targetMap.keys())
  const start = targetTimes[0]
  const end = targetTimes.at(-1)
  const dates = Array.from(new Set([...targetTimes, ...benchmarkMap.keys()]))
    .filter((time) => start != null && end != null && time >= start && time <= end)
    .sort((a, b) => a - b)
  let targetPoints: DailyPoint[] = []
  let benchmarkPoints: DailyPoint[] = []
  const incompleteMonths = new Set<number>()
  for (const time of dates) {
    const targetValue = targetMap.get(time)
    const benchmarkValue = benchmarkMap.get(time)
    if (
      targetValue == null ||
      benchmarkValue == null ||
      !Number.isFinite(targetValue) ||
      !Number.isFinite(benchmarkValue)
    ) {
      const date = new Date(time)
      incompleteMonths.add(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      continue
    }
    targetPoints.push({ time, value: targetValue })
    benchmarkPoints.push({ time, value: benchmarkValue })
  }
  if (frequency === 'monthly') {
    // Do not turn an incomplete benchmark month into a plausible monthly return
    // by compounding only its available days. Boundary months use the selected range.
    targetPoints = computeMonthlyReturns(targetPoints).filter(
      (point) => !incompleteMonths.has(point.time),
    )
    benchmarkPoints = computeMonthlyReturns(benchmarkPoints).filter(
      (point) => !incompleteMonths.has(point.time),
    )
  }
  const observations = targetPoints.length
  const unavailable = { observations, beta: null, correlation: null }
  if (observations < 3) return unavailable
  const targetValues = targetPoints.map((point) => point.value)
  const benchmarkValues = benchmarkPoints.map((point) => point.value)
  if ([...targetValues, ...benchmarkValues].some((value) => !Number.isFinite(value)))
    return unavailable
  const targetMean = targetValues.reduce((sum, value) => sum + value, 0) / observations
  const benchmarkMean = benchmarkValues.reduce((sum, value) => sum + value, 0) / observations
  let covariance = 0
  let benchmarkVariance = 0
  for (let index = 0; index < observations; index++) {
    const benchmarkDeviation = benchmarkValues[index] - benchmarkMean
    covariance += (targetValues[index] - targetMean) * benchmarkDeviation
    benchmarkVariance += benchmarkDeviation * benchmarkDeviation
  }
  // QuantConnect/LEAN's pairwise beta: Cov(target, benchmark) / Var(benchmark).
  // Sample/population normalization cancels in the ratio. Undefined variance
  // remains unavailable here rather than being presented as zero exposure.
  const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : NaN
  const rho = correlation(targetValues, benchmarkValues)
  return {
    observations,
    beta: Number.isFinite(beta) ? beta : null,
    correlation: rho != null && Number.isFinite(rho) ? Math.max(-1, Math.min(1, rho)) : null,
  }
}
