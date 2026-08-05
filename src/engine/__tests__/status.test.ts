import { describe, expect, it } from 'vitest'
import type { ShockFlag } from '../ddShock'
import {
  DECAY_STATUS_POLICY,
  computeAlphaPercentiles,
  computeStatus,
  type AlphaEvidenceInput,
} from '../status'

const DAY_MS = 24 * 60 * 60 * 1000
const reportTime = Date.UTC(2026, 6, 31)

const alphaEvidence = (overrides: Partial<AlphaEvidenceInput> = {}): AlphaEvidenceInput => ({
  source: 'PORTFOLIO',
  alignedObservations: 504,
  requiredAlignedObservations: 403,
  activeObservations: 30,
  requiredActiveObservations: 30,
  reportTime,
  lastValidTime: reportTime,
  ...overrides,
})

const strongAlpha = Array.from({ length: 40 }, (_, index) => index + 1)

const statusInputs = (
  overrides: Partial<{
    alphaSeries: number[]
    alphaEvidence: AlphaEvidenceInput
    winrateSeries: number[]
    last1YSharpe: number | null
    last2YSharpe: number | null
    overallSharpe: number | null
    last2YWinrate: number | null
    shock: ShockFlag
  }> = {},
) => ({
  alphaSeries: strongAlpha,
  alphaEvidence: alphaEvidence(),
  winrateSeries: [0.4, 0.6],
  last1YSharpe: 0.8,
  last2YSharpe: 0.8,
  overallSharpe: 0.8,
  last2YWinrate: 0.6,
  shock: 'NONE' as ShockFlag,
  ...overrides,
})

describe('computeAlphaPercentiles', () => {
  it('uses an upper-bound rank for finite values and ties', () => {
    const result = computeAlphaPercentiles([1, 2, 2, 4, Number.NaN])

    expect(result.slice(0, 4)).toEqual([25, 75, 75, 100])
    expect(Number.isNaN(result[4])).toBe(true)
  })

  it('returns NaN for every item when there are no finite observations', () => {
    const result = computeAlphaPercentiles([Number.NaN, Number.POSITIVE_INFINITY])

    expect(result.every((value) => Number.isNaN(value))).toBe(true)
  })
})

describe('computeStatus', () => {
  it('returns green for current supported alpha without confirmed decay', () => {
    const result = computeStatus(statusInputs())

    expect(result.status).toBe('GREEN')
    expect(result.alphaPercentile).toBe(100)
    expect(result.alphaEvidence.state).toBe('CURRENT')
    expect(result.reasons).toEqual(['NO_CONFIRMED_DECAY'])
  })

  it('uses red conditions before otherwise green conditions', () => {
    expect(computeStatus(statusInputs({ shock: 'RED' })).status).toBe('RED')
    expect(computeStatus(statusInputs({ overallSharpe: -0.01 })).status).toBe('RED')
  })

  it('keeps real warnings yellow when alpha evidence is unavailable', () => {
    const unavailableAlpha = [...strongAlpha, Number.NaN]
    const evidence = alphaEvidence({
      activeObservations: 29,
      lastValidTime: reportTime - DAY_MS,
    })

    expect(
      computeStatus(
        statusInputs({
          alphaSeries: unavailableAlpha,
          alphaEvidence: evidence,
          last1YSharpe: -0.01,
        }),
      ).status,
    ).toBe('YELLOW')
    expect(
      computeStatus(
        statusInputs({
          alphaSeries: unavailableAlpha,
          alphaEvidence: evidence,
          shock: 'ORANGE',
        }),
      ).status,
    ).toBe('YELLOW')
  })

  it('returns unknown instead of yellow for missing or stale alpha alone', () => {
    const result = computeStatus(
      statusInputs({
        alphaSeries: [...strongAlpha, Number.NaN],
        alphaEvidence: alphaEvidence({
          activeObservations: 29,
          lastValidTime: reportTime - DAY_MS,
        }),
      }),
    )

    expect(result.status).toBe('UNKNOWN')
    expect(result.alphaPercentile).toBeNull()
    expect(result.alphaEvidence).toMatchObject({
      state: 'INSUFFICIENT',
      activeObservations: 29,
      requiredActiveObservations: 30,
      lastValidTime: reportTime - DAY_MS,
    })
    expect(result.reasons).toEqual(['ALPHA_INSUFFICIENT'])
  })

  it('requires enough percentile history before resolving a healthy status', () => {
    const alphaSeries = strongAlpha.slice(0, DECAY_STATUS_POLICY.minAlphaHistory - 1)
    const result = computeStatus(statusInputs({ alphaSeries }))

    expect(result.status).toBe('UNKNOWN')
    expect(result.alphaEvidence.historyObservations).toBe(29)
    expect(result.alphaEvidence.requiredHistoryObservations).toBe(30)
  })

  it('confirms alpha decay from a persistent recent percentile signal', () => {
    const historicalHigh = Array.from({ length: 40 }, (_, index) => 100 + index)
    const recentLow = Array.from({ length: 21 }, (_, index) => index + 1)
    const result = computeStatus(statusInputs({ alphaSeries: [...historicalHigh, ...recentLow] }))

    expect(result.status).toBe('YELLOW')
    expect(result.alphaPercentile).toBeLessThan(40)
    expect(result.alphaRecentObservationCount).toBe(21)
    expect(result.alphaWeakObservations).toBe(21)
    expect(result.reasons).toContain('ALPHA_WEAK_PERSISTENT')
  })

  it('does not flag a short alpha dip as confirmed decay', () => {
    const historicalHigh = Array.from({ length: 40 }, (_, index) => 100 + index)
    const recentLow = Array.from({ length: 5 }, (_, index) => index + 1)
    const result = computeStatus(statusInputs({ alphaSeries: [...historicalHigh, ...recentLow] }))

    expect(result.alphaPercentile).toBeLessThan(40)
    expect(result.alphaWeakObservations).toBe(5)
    expect(result.status).toBe('GREEN')
  })

  it('treats a two-year Sharpe at or below the floor as an observed warning', () => {
    expect(computeStatus(statusInputs({ last2YSharpe: 0.5 })).status).toBe('YELLOW')
    expect(computeStatus(statusInputs({ last2YSharpe: 0.500001 })).status).toBe('GREEN')
  })

  it('uses only the current winrate percentile rather than a stale value', () => {
    const result = computeStatus(
      statusInputs({
        winrateSeries: [0.2, 0.8, Number.NaN],
        last1YSharpe: Number.NaN,
        overallSharpe: null,
        last2YWinrate: Number.NaN,
      }),
    )

    expect(result.winratePercentile).toBeNull()
    expect(result.last1YSharpe).toBeNull()
    expect(result.overallSharpe).toBeNull()
    expect(result.last2YWinrate).toBeNull()
  })
})
