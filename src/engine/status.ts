import type { ShockFlag } from './ddShock'

export type StatusFlag = 'GREEN' | 'YELLOW' | 'RED'

export type StatusResult = {
  status: StatusFlag
  shock: ShockFlag
  alphaPercentile: number
  alphaWeakStreakDays: number
  last1YSharpe: number | null
  last2YSharpe: number | null
  overallSharpe: number | null
  last2YWinrate: number | null
  winratePercentile: number | null
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
  last1YSharpe: number | null
  last2YSharpe: number | null
  overallSharpe: number | null
  last2YWinrate: number | null
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
  const last1YSharpe = toFiniteOrNull(inputs.last1YSharpe)
  const last2YSharpe = toFiniteOrNull(inputs.last2YSharpe)
  const overallSharpe = toFiniteOrNull(inputs.overallSharpe)
  const last2YWinrate = toFiniteOrNull(inputs.last2YWinrate)
  const winratePct = toFiniteOrNull(winratePercentile)

  const redCondition =
    inputs.shock === 'RED' ||
    (overallSharpe != null && overallSharpe < 0)

  const greenCondition =
    Number.isFinite(alphaPercentile) &&
    alphaPercentile >= 40 &&
    last2YSharpe != null &&
    last2YSharpe > 0.5

  const yellowCondition =
    (Number.isFinite(alphaPercentile) && alphaPercentile >= 15 && alphaPercentile < 40) ||
    (last1YSharpe != null && last1YSharpe < 0) ||
    inputs.shock === 'ORANGE'

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

  return {
    status,
    shock: inputs.shock,
    alphaPercentile,
    alphaWeakStreakDays: weakStreak,
    last1YSharpe,
    last2YSharpe,
    overallSharpe,
    last2YWinrate,
    winratePercentile: winratePct,
  }
}
