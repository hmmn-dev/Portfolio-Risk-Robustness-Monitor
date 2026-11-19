import { describe, expect, it } from 'vitest'
import { createReport } from '../../../test/reportFixtures'
import { buildFactorRelationships } from '../portfolio/factorRelationships'

const times = [0, 1, 2, 3].map((index) => Date.UTC(2024, 0, index + 1))
const returns = [0.01, -0.02, 0.03, -0.04].map((value, index) => ({ time: times[index], value }))
const raw = createReport().contributions.map((item, index) => ({
  ...item,
  symbol: 'EURUSD',
  returns: returns.map((point) => ({ ...point, value: point.value * (index + 1) })),
}))
const underlying = [
  {
    symbol: 'EURUSD',
    timeframe: 'D1' as const,
    candles: [],
    daily: returns.map((point) => ({
      symbol: 'EURUSD',
      time: point.time,
      close: 100,
      return: point.value,
    })),
  },
]

describe('factor relationship data', () => {
  it('uses the displayed equity returns for the whole portfolio and aggregates selected weighted symbol contributions', () => {
    const result = buildFactorRelationships({
      portfolioReturns: returns.map((point) => ({ ...point, value: 0.25 * point.value })),
      contributions: raw,
      weights: { [raw[0].sleeve]: 2, [raw[1].sleeve]: 0.5 },
      underlying,
    })
    expect(result.portfolio.daily[0].beta).toBeCloseTo(0.25)
    expect(result.symbols.daily[0].beta).toBeCloseTo(3)
    const selected = buildFactorRelationships({
      portfolioReturns: returns,
      contributions: [raw[0]],
      weights: {},
      underlying,
    })
    expect(selected.symbols.daily[0].beta).toBeCloseTo(1)
    expect(raw[0].returns).toEqual(returns)
  })

  it('unpacks bucket membership by actual traded symbol and applies the bucket weight once', () => {
    const constituents = raw.map((item, index) => ({
      ...item,
      symbol: index ? 'USDJPY' : 'EURUSD',
    }))
    const bucket = {
      ...raw[0],
      key: 'bucket',
      sleeve: 'Strategy - EQ',
      symbol: 'EQ',
      grouping: {
        kind: 'bucket' as const,
        name: 'EQ',
        strategy: 'Strategy',
        members: constituents.map(({ key, sleeve, symbol }) => ({ key, sleeve, symbol })),
      },
    }
    const result = buildFactorRelationships({
      portfolioReturns: returns,
      contributions: [bucket],
      rawContributions: constituents,
      weights: { [bucket.sleeve]: 2 },
      underlying,
    })
    expect(result.symbols.daily.map((row) => row.symbol)).toEqual(['EURUSD', 'USDJPY'])
    expect(result.symbols.daily[0].beta).toBeCloseTo(2)
    expect(result.symbols.daily[1].beta).toBeNull()
    expect(result.symbols.daily[1].observations).toBe(0)
  })

  it('keeps range filtering, zero exposure and unavailable data explicit', () => {
    const result = buildFactorRelationships({
      portfolioReturns: returns.slice(2),
      contributions: raw,
      weights: { [raw[1].sleeve]: 0 },
      underlying,
    })
    expect(result.symbols.daily).toHaveLength(1)
    expect(result.symbols.daily[0].observations).toBe(2)
    expect(result.symbols.daily[0].beta).toBeNull()
    expect(
      buildFactorRelationships({
        portfolioReturns: [],
        contributions: [],
        weights: {},
        underlying: [],
      }).portfolio.daily,
    ).toEqual([])
  })

  it('does not silently drop missing constituent returns from a symbol aggregate', () => {
    const partial = raw.map((item, index) =>
      index ? { ...item, returns: item.returns.slice(2) } : item,
    )
    const result = buildFactorRelationships({
      portfolioReturns: returns,
      contributions: partial,
      weights: {},
      underlying,
    })
    expect(result.symbols.daily[0].observations).toBe(2)
    expect(result.symbols.daily[0].beta).toBeNull()
  })
})
