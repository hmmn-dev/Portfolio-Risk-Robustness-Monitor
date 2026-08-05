import type { ShockFlag } from './ddShock'

export const DECAY_STATUS_POLICY = {
  minAlignedRatio: 0.8,
  minActiveObservations: 30,
  minAlphaHistory: 30,
  alphaWarningPercentile: 40,
  alphaWarningLookback: 21,
  alphaWarningMinimumWeak: 16,
  last2YSharpeFloor: 0.5,
} as const

export type StatusFlag = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
export type AlphaEvidenceState = 'CURRENT' | 'INSUFFICIENT'
export type AlphaBenchmarkSource = 'UNDERLYING' | 'PORTFOLIO'

export type AlphaEvidenceInput = {
  source: AlphaBenchmarkSource
  alignedObservations: number
  requiredAlignedObservations: number
  activeObservations: number
  requiredActiveObservations: number
  reportTime: number | null
  lastValidTime: number | null
}

export type AlphaEvidence = AlphaEvidenceInput & {
  state: AlphaEvidenceState
  historyObservations: number
  requiredHistoryObservations: number
}

export type StatusReason =
  | 'DD_SHOCK_RED'
  | 'OVERALL_SHARPE_NEGATIVE'
  | 'DD_SHOCK_ORANGE'
  | 'ONE_YEAR_SHARPE_NEGATIVE'
  | 'TWO_YEAR_SHARPE_WEAK'
  | 'ALPHA_WEAK_PERSISTENT'
  | 'ALPHA_INSUFFICIENT'
  | 'ONE_YEAR_SHARPE_INSUFFICIENT'
  | 'TWO_YEAR_SHARPE_INSUFFICIENT'
  | 'OVERALL_SHARPE_INSUFFICIENT'
  | 'NO_CONFIRMED_DECAY'

export type StatusResult = {
  status: StatusFlag
  reasons: StatusReason[]
  shock: ShockFlag
  alphaPercentile: number | null
  alphaWeakObservations: number
  alphaRecentObservationCount: number
  alphaEvidence: AlphaEvidence
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

const latestFiniteOrNull = (values: number[]) => {
  const value = values[values.length - 1]
  return Number.isFinite(value) ? value : null
}

const trailingFinite = (values: number[], limit: number) => {
  const result: number[] = []
  for (let index = values.length - 1; index >= 0 && result.length < limit; index -= 1) {
    const value = values[index]
    if (!Number.isFinite(value)) break
    result.push(value)
  }
  return result
}

export const computeStatus = (inputs: {
  alphaSeries: number[]
  alphaEvidence: AlphaEvidenceInput
  winrateSeries: number[]
  last1YSharpe: number | null
  last2YSharpe: number | null
  overallSharpe: number | null
  last2YWinrate: number | null
  shock: ShockFlag
}): StatusResult => {
  const percentiles = computeAlphaPercentiles(inputs.alphaSeries)
  const alphaHistoryObservations = percentiles.filter((value) => Number.isFinite(value)).length
  const alphaPercentileCandidate = latestFiniteOrNull(percentiles)
  const recentAlphaPercentiles = trailingFinite(
    percentiles,
    DECAY_STATUS_POLICY.alphaWarningLookback,
  )
  const alphaWeakObservations = recentAlphaPercentiles.filter(
    (value) => value < DECAY_STATUS_POLICY.alphaWarningPercentile,
  ).length
  const alphaIsCurrent =
    alphaPercentileCandidate != null &&
    inputs.alphaEvidence.reportTime != null &&
    inputs.alphaEvidence.lastValidTime === inputs.alphaEvidence.reportTime &&
    inputs.alphaEvidence.alignedObservations >= inputs.alphaEvidence.requiredAlignedObservations &&
    inputs.alphaEvidence.activeObservations >= inputs.alphaEvidence.requiredActiveObservations &&
    alphaHistoryObservations >= DECAY_STATUS_POLICY.minAlphaHistory &&
    recentAlphaPercentiles.length >= DECAY_STATUS_POLICY.alphaWarningLookback
  const alphaEvidence: AlphaEvidence = {
    ...inputs.alphaEvidence,
    state: alphaIsCurrent ? 'CURRENT' : 'INSUFFICIENT',
    historyObservations: alphaHistoryObservations,
    requiredHistoryObservations: DECAY_STATUS_POLICY.minAlphaHistory,
  }
  const alphaPercentile = alphaIsCurrent ? alphaPercentileCandidate : null
  const alphaWeakPersistent =
    alphaPercentile != null &&
    alphaPercentile < DECAY_STATUS_POLICY.alphaWarningPercentile &&
    alphaWeakObservations >= DECAY_STATUS_POLICY.alphaWarningMinimumWeak

  const winratePercentile = latestFiniteOrNull(computeAlphaPercentiles(inputs.winrateSeries ?? []))
  const toFiniteOrNull = (value: number | null | undefined) =>
    Number.isFinite(value) ? (value as number) : null
  const last1YSharpe = toFiniteOrNull(inputs.last1YSharpe)
  const last2YSharpe = toFiniteOrNull(inputs.last2YSharpe)
  const overallSharpe = toFiniteOrNull(inputs.overallSharpe)
  const last2YWinrate = toFiniteOrNull(inputs.last2YWinrate)

  const redReasons: StatusReason[] = []
  if (inputs.shock === 'RED') redReasons.push('DD_SHOCK_RED')
  if (overallSharpe != null && overallSharpe < 0) {
    redReasons.push('OVERALL_SHARPE_NEGATIVE')
  }

  const yellowReasons: StatusReason[] = []
  if (inputs.shock === 'ORANGE') yellowReasons.push('DD_SHOCK_ORANGE')
  if (last1YSharpe != null && last1YSharpe < 0) {
    yellowReasons.push('ONE_YEAR_SHARPE_NEGATIVE')
  }
  if (last2YSharpe != null && last2YSharpe <= DECAY_STATUS_POLICY.last2YSharpeFloor) {
    yellowReasons.push('TWO_YEAR_SHARPE_WEAK')
  }
  if (alphaWeakPersistent) yellowReasons.push('ALPHA_WEAK_PERSISTENT')

  const insufficientReasons: StatusReason[] = []
  if (alphaEvidence.state === 'INSUFFICIENT') {
    insufficientReasons.push('ALPHA_INSUFFICIENT')
  }
  if (last1YSharpe == null) insufficientReasons.push('ONE_YEAR_SHARPE_INSUFFICIENT')
  if (last2YSharpe == null) insufficientReasons.push('TWO_YEAR_SHARPE_INSUFFICIENT')
  if (overallSharpe == null) insufficientReasons.push('OVERALL_SHARPE_INSUFFICIENT')

  let status: StatusFlag
  let reasons: StatusReason[]
  if (redReasons.length > 0) {
    status = 'RED'
    reasons = redReasons
  } else if (yellowReasons.length > 0) {
    status = 'YELLOW'
    reasons = yellowReasons
  } else if (insufficientReasons.length > 0) {
    status = 'UNKNOWN'
    reasons = insufficientReasons
  } else {
    status = 'GREEN'
    reasons = ['NO_CONFIRMED_DECAY']
  }

  return {
    status,
    reasons,
    shock: inputs.shock,
    alphaPercentile,
    alphaWeakObservations,
    alphaRecentObservationCount: recentAlphaPercentiles.length,
    alphaEvidence,
    last1YSharpe,
    last2YSharpe,
    overallSharpe,
    last2YWinrate,
    winratePercentile,
  }
}
