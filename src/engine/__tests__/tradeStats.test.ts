import { describe, expect, it } from 'vitest'
import { computeTradeStats } from '../tradeStats'
import type { DealRow } from '../types'

const day = (offset: number) => Date.UTC(2026, 0, 1 + offset)

const makeDeal = (overrides: Partial<DealRow>): DealRow => ({
  deal: 'D0',
  time: day(0),
  sleeve: 'Alpha - SPY',
  symbol: 'SPY',
  notional: 0,
  entryType: 'in',
  side: 'buy',
  positionId: 1,
  _seq: 0,
  ...overrides,
})

describe('computeTradeStats', () => {
  it('counts unique opened positions and calculates the long share', () => {
    const stats = computeTradeStats([
      makeDeal({ deal: 'A1', positionId: 1, side: 'buy' }),
      makeDeal({ deal: 'A2', positionId: 1, side: 'buy', _seq: 1 }),
      makeDeal({ deal: 'A3', positionId: 1, entryType: 'out', _seq: 2 }),
      makeDeal({ deal: 'B1', positionId: 2, side: 'sell', _seq: 3 }),
      makeDeal({ deal: 'C1', positionId: 3, side: 'buy', _seq: 4 }),
    ])

    expect(stats).toEqual({
      tradeCount: 3,
      directionalTradeCount: 3,
      longExposurePct: expect.closeTo((2 / 3) * 100),
    })
  })

  it('filters by sleeve and original opening time before counting', () => {
    const stats = computeTradeStats(
      [
        makeDeal({ deal: 'A1', time: day(0), positionId: 1 }),
        makeDeal({ deal: 'A2', time: day(2), positionId: 1, _seq: 1 }),
        makeDeal({ deal: 'B1', time: day(2), positionId: 2, side: 'sell', _seq: 2 }),
        makeDeal({
          deal: 'C1',
          time: day(2),
          sleeve: 'Beta - QQQ',
          symbol: 'QQQ',
          positionId: 3,
          _seq: 3,
        }),
      ],
      {
        sleeves: new Set(['Alpha - SPY']),
        startTime: day(1),
        endTime: day(3),
      },
    )

    expect(stats).toEqual({ tradeCount: 1, directionalTradeCount: 1, longExposurePct: 0 })
  })

  it('reports unavailable long exposure when directions are missing', () => {
    const stats = computeTradeStats([
      makeDeal({ positionId: 0, side: undefined }),
      makeDeal({ deal: 'D1', positionId: 0, side: undefined, _seq: 1 }),
    ])

    expect(stats.tradeCount).toBe(2)
    expect(stats.directionalTradeCount).toBe(0)
    expect(stats.longExposurePct).toBeNaN()
  })

  it('excludes positions with conflicting entry directions from long exposure', () => {
    const stats = computeTradeStats([
      makeDeal({ deal: 'A1', positionId: 1, side: 'buy' }),
      makeDeal({ deal: 'A2', positionId: 1, side: 'sell', _seq: 1 }),
      makeDeal({ deal: 'A3', positionId: 1, side: 'buy', _seq: 2 }),
    ])

    expect(stats.tradeCount).toBe(1)
    expect(stats.directionalTradeCount).toBe(0)
    expect(stats.longExposurePct).toBeNaN()
  })
})
