import { describe, expect, it } from 'vitest'
import { computeAlphaPercentiles, computeStatus } from '../status'
import type { ShockFlag } from '../ddShock'

const statusInputs = (
  overrides: Partial<{
    alphaSeries: number[]
    winrateSeries: number[]
    last1YSharpe: number | null
    last2YSharpe: number | null
    overallSharpe: number | null
    last2YWinrate: number | null
    shock: ShockFlag
    weakWindowDays: number
  }> = {},
) => ({
  alphaSeries: [1, 2],
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
  it('returns green for strong alpha percentile and two-year Sharpe', () => {
    expect(computeStatus(statusInputs()).status).toBe('GREEN')
  })

  it('uses red conditions before otherwise green conditions', () => {
    expect(computeStatus(statusInputs({ shock: 'RED' })).status).toBe('RED')
    expect(computeStatus(statusInputs({ overallSharpe: -0.01 })).status).toBe('RED')
  })

  it('returns yellow for medium alpha or a negative one-year Sharpe', () => {
    const mediumAlpha = computeStatus(
      statusInputs({ alphaSeries: [2, 3, 4, 1], last2YSharpe: 0.8 }),
    )
    const weakRecentSharpe = computeStatus(statusInputs({ last1YSharpe: -0.01 }))

    expect(mediumAlpha.alphaPercentile).toBe(25)
    expect(mediumAlpha.status).toBe('YELLOW')
    expect(weakRecentSharpe.status).toBe('YELLOW')
  })

  it('downgrades an otherwise green result for an orange drawdown shock', () => {
    const result = computeStatus(statusInputs({ shock: 'ORANGE' }))

    expect(result.status).toBe('YELLOW')
    expect(result.shock).toBe('ORANGE')
  })

  it('counts the trailing weak-alpha streak and caps it to the configured window', () => {
    const alphaSeries = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 2, 1]

    expect(computeStatus(statusInputs({ alphaSeries })).alphaWeakStreakDays).toBe(2)
    expect(
      computeStatus(statusInputs({ alphaSeries, weakWindowDays: 1 })).alphaWeakStreakDays,
    ).toBe(1)
  })

  it('normalizes non-finite summary metrics to null', () => {
    const result = computeStatus(
      statusInputs({
        alphaSeries: [Number.NaN],
        winrateSeries: [0.2, 0.8, 0.5],
        last1YSharpe: Number.NaN,
        last2YSharpe: Number.POSITIVE_INFINITY,
        overallSharpe: null,
        last2YWinrate: Number.NaN,
      }),
    )

    expect(Number.isNaN(result.alphaPercentile)).toBe(true)
    expect(result.winratePercentile).toBeCloseTo(200 / 3)
    expect(result.last1YSharpe).toBeNull()
    expect(result.last2YSharpe).toBeNull()
    expect(result.overallSharpe).toBeNull()
    expect(result.last2YWinrate).toBeNull()
  })
})
