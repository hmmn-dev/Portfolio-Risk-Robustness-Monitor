import { describe, expect, it } from 'vitest'
import { computeAttribution } from '../attribution'
import { correlation } from '../correlation'
import { computeMetrics } from '../metrics'
import type { DailySeries, DealRow } from '../types'

const makeDeal = (sleeve: string, notional: number, index: number): DealRow => ({
  deal: `D${index}`,
  time: index,
  sleeve,
  notional,
  _seq: index,
})

describe('computeMetrics', () => {
  it('sums all point values and counts sleeves', () => {
    const series: DailySeries[] = [
      {
        sleeve: 'Alpha',
        points: [
          { time: 1, value: 10 },
          { time: 2, value: -3 },
        ],
      },
      {
        sleeve: 'Beta',
        points: [{ time: 1, value: 5 }],
      },
    ]

    expect(computeMetrics(series)).toEqual({ totalExposure: 12, sleeves: 2 })
  })

  it('returns zero totals for an empty set', () => {
    expect(computeMetrics([])).toEqual({ totalExposure: 0, sleeves: 0 })
  })
})

describe('computeAttribution', () => {
  it('nets positive and negative notionals by sleeve', () => {
    const deals = [makeDeal('Alpha', 10, 1), makeDeal('Beta', 4, 2), makeDeal('Alpha', -3, 3)]

    expect(computeAttribution(deals)).toEqual({ Alpha: 7, Beta: 4 })
  })

  it('returns an empty object when there are no deals', () => {
    expect(computeAttribution([])).toEqual({})
  })
})

describe('correlation', () => {
  it('calculates perfect positive and negative correlations', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
  })

  it('returns null when series cannot be compared', () => {
    expect(correlation([], [])).toBeNull()
    expect(correlation([1], [1, 2])).toBeNull()
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull()
  })
})
