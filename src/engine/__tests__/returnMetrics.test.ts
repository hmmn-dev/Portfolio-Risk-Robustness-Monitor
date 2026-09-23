import { describe, expect, it } from 'vitest'
import {
  computeAnnualizedSortino,
  computeMonthlyReturns,
  computeProfitableMonthsPct,
} from '../returnMetrics'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

describe('computeAnnualizedSortino', () => {
  it('annualizes mean daily return against zero-target downside deviation', () => {
    const returns = [0.02, -0.01, 0.03].map((value, index) => ({ time: day(index), value }))
    const mean = (0.02 - 0.01 + 0.03) / 3
    const downsideDeviation = Math.sqrt((0 + Math.pow(-0.01, 2) + 0) / 3)

    expect(computeAnnualizedSortino(returns)).toBeCloseTo(
      (mean * Math.sqrt(252)) / downsideDeviation,
    )
  })

  it('ignores non-finite returns and rejects unavailable downside risk', () => {
    expect(
      computeAnnualizedSortino([
        { time: day(0), value: Number.NaN },
        { time: day(1), value: 0.01 },
      ]),
    ).toBeNaN()
    expect(computeAnnualizedSortino([], 252)).toBeNaN()
    expect(computeAnnualizedSortino([{ time: day(0), value: -0.01 }], 0)).toBeNaN()
  })
})

describe('monthly return metrics', () => {
  it('compounds finite daily returns into sorted UTC calendar months', () => {
    const returns = [
      { time: Date.UTC(2024, 1, 1), value: 0.05 },
      { time: Date.UTC(2024, 0, 2), value: 0.1 },
      { time: Date.UTC(2024, 0, 3), value: -0.2 },
      { time: Date.UTC(2024, 2, 1), value: Number.NaN },
    ]

    const monthlyReturns = computeMonthlyReturns(returns)

    expect(monthlyReturns).toHaveLength(2)
    expect(monthlyReturns[0]).toEqual({
      time: Date.UTC(2024, 0, 1),
      value: expect.closeTo(-0.12),
    })
    expect(monthlyReturns[1]).toEqual({
      time: Date.UTC(2024, 1, 1),
      value: expect.closeTo(0.05),
    })
    expect(computeProfitableMonthsPct(returns)).toBe(50)
  })

  it('counts flat observed months as non-profitable and preserves missing data', () => {
    expect(computeProfitableMonthsPct([{ time: day(0), value: 0 }])).toBe(0)
    expect(computeProfitableMonthsPct([])).toBeNaN()
    expect(computeProfitableMonthsPct([{ time: Number.NaN, value: 0.1 }])).toBeNaN()
  })
})
