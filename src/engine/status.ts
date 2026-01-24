import type { ShockFlag } from './ddShock'

export type StatusFlag = 'GREEN' | 'YELLOW' | 'RED'

export type StatusResult = {
  status: StatusFlag
  shock: ShockFlag
  alphaPercentile: number
  alphaWeakStreakDays: number
  last3MSharpe: number | null
  last6MSharpe: number | null
  last6MWinrate: number | null
  winratePercentile: number | null
  last6MExpectancy: number | null
}

const upperBound = (values: number[], target: number) => {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (values[mid] <= target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

export const computeAlphaPercentiles = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return values.map(() => Number.NaN)
  const sorted = [...finite].sort((a, b) => a - b)
  return values.map((value) => {
    if (!Number.isFinite(value)) return Number.NaN
    const rank = upperBound(sorted, value)
    return (rank / sorted.length) * 100
  })
}

const computeWeakStreak = (percentiles: number[], threshold = 15, window = 42) => {
  let streak = 0
  for (let i = percentiles.length - 1; i >= 0; i -= 1) {
    const value = percentiles[i]
    if (!Number.isFinite(value) || value >= threshold) break
    streak += 1
    if (streak >= window) break
  }
  return streak
}

const lastFinite = (values: number[]) => {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(values[i])) return values[i]
  }
  return Number.NaN
}

export const computeStatus = (inputs: {
  alphaSeries: number[]
  winrateSeries: number[]
  last3MSharpe: number | null
  last6MSharpe: number | null
  last6MWinrate: number | null
  last6MExpectancy: number | null
  shock: ShockFlag
  weakWindowDays?: number
}): StatusResult => {
  const percentiles = computeAlphaPercentiles(inputs.alphaSeries)
  const alphaPercentile = lastFinite(percentiles)
  const winratePercentiles = computeAlphaPercentiles(inputs.winrateSeries ?? [])
  const winratePercentile = lastFinite(winratePercentiles)
  const toFiniteOrNull = (value: number | null | undefined) =>
    Number.isFinite(value) ? (value as number) : null
  const weakStreak = computeWeakStreak(
    percentiles,
    15,
    inputs.weakWindowDays ?? 42
  )
  const last3MSharpe = toFiniteOrNull(inputs.last3MSharpe)
  const last6MSharpe = toFiniteOrNull(inputs.last6MSharpe)
  const last6MWinrate = toFiniteOrNull(inputs.last6MWinrate)
  const last6MExpectancy = toFiniteOrNull(inputs.last6MExpectancy)
  const winratePct = toFiniteOrNull(winratePercentile)

  const redCondition =
    weakStreak >= (inputs.weakWindowDays ?? 42) &&
    last6MSharpe != null &&
    last6MSharpe < 0 &&
    last6MExpectancy != null &&
    last6MExpectancy < 0 &&
    winratePct != null &&
    winratePct < 20

  const greenCondition =
    (Number.isFinite(alphaPercentile) && alphaPercentile >= 40) ||
    (last6MSharpe != null && last6MSharpe > 0.5)
  const yellowCondition =
    (Number.isFinite(alphaPercentile) && alphaPercentile >= 20 && alphaPercentile < 40) ||
    (last3MSharpe != null && last3MSharpe < 0)

  let status: StatusFlag = 'YELLOW'
  if (redCondition) {
    status = 'RED'
  } else if (greenCondition) {
    status = 'GREEN'
  } else if (yellowCondition) {
    status = 'YELLOW'
  }

  if (inputs.shock === 'ORANGE' && status === 'GREEN') {
    status = 'YELLOW'
  }
  if (inputs.shock === 'RED') {
    status = 'RED'
  }

  return {
    status,
    shock: inputs.shock,
    alphaPercentile,
    alphaWeakStreakDays: weakStreak,
    last3MSharpe,
    last6MSharpe,
    last6MWinrate,
    winratePercentile: winratePct,
    last6MExpectancy,
  }
}
