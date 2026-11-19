import { describe, expect, it } from 'vitest'
import { buildMtmDrawdown } from '../mtmDrawdown'
import type { DealRow, UnderlyingSeries } from '../types'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

const buildPortfolioFixture = (sleeveCount: number) => {
  const deals: DealRow[] = []
  const underlyingSeries: UnderlyingSeries[] = []
  const sleeves: string[] = []

  for (let index = 0; index < sleeveCount; index += 1) {
    const sleeve = `Sleeve ${index + 1}`
    const symbol = `ASSET${index + 1}`
    const selectedLoss = index < 10 ? -1 : -10
    const exitPrice = 100 + selectedLoss
    sleeves.push(sleeve)
    deals.push(
      {
        deal: `${index}-open`,
        time: day(0),
        sleeve,
        symbol,
        notional: 0,
        price: 100,
        side: 'buy',
        volume: 1,
        entryType: 'in',
        positionId: index + 1,
        _seq: index * 2,
      },
      {
        deal: `${index}-close`,
        time: day(2),
        sleeve,
        symbol,
        notional: selectedLoss,
        price: exitPrice,
        volume: 1,
        entryType: 'out',
        profit: selectedLoss,
        positionId: index + 1,
        _seq: index * 2 + 1,
      },
    )
    underlyingSeries.push({
      symbol,
      timeframe: index === sleeveCount - 1 ? 'H1' : 'D1',
      candles: [
        { time: day(0), open: 100, high: 100, low: 100, close: 100 },
        {
          time: day(1),
          open: exitPrice,
          high: exitPrice,
          low: exitPrice,
          close: exitPrice,
        },
        {
          time: day(2),
          open: exitPrice,
          high: exitPrice,
          low: exitPrice,
          close: exitPrice,
        },
      ],
      daily: [],
    })
  }

  return { deals, sleeves, underlyingSeries }
}

describe('buildMtmDrawdown', () => {
  it('preserves export order for custom positions opened and closed at the same timestamp', () => {
    const fixture = buildPortfolioFixture(1)
    const deals = [
      { ...fixture.deals[0], deal: '2' },
      { ...fixture.deals[1], deal: '10', time: day(0) },
    ]
    const result = buildMtmDrawdown(deals, fixture.underlyingSeries, 1000, {
      sleeves: new Set(fixture.sleeves),
      includeRealizedFallback: true,
    })
    expect(result?.equity?.index[0].value).toBeCloseTo(0.999)
  })

  it('does not silently replace a zero account-equity denominator with modeled balance', () => {
    const fixture = buildPortfolioFixture(1)
    const result = buildMtmDrawdown(fixture.deals, fixture.underlyingSeries, 1000, {
      sleeves: new Set(fixture.sleeves),
      includeRealizedFallback: true,
      baselineEquityIndex: [{ time: day(0), value: 0 }],
    })
    expect(result?.equity).toBeUndefined()
  })
  it.each([0, 1])(
    'preserves zero/unit exposure on the combined custom timeline (weight %s)',
    (weight) => {
      const fixture = buildPortfolioFixture(1)
      const prices = fixture.underlyingSeries.map((series) => ({
        ...series,
        timeframe: 'D1' as const,
        candles: series.candles.slice(1, 2),
      }))
      const baseline = buildMtmDrawdown(fixture.deals, prices, 1000, {
        includeRealizedFallback: true,
      })
      const custom = buildMtmDrawdown(fixture.deals, prices, 1000, {
        sleeves: new Set(fixture.sleeves),
        sleeveWeights: { [fixture.sleeves[0]]: weight },
        includeRealizedFallback: true,
      })
      expect(custom?.equity?.index).toHaveLength(3)
      custom?.equity?.index.forEach((point, index) =>
        expect(point.value).toBeCloseTo(weight ? (baseline?.equity?.index[index].value ?? NaN) : 1),
      )
    },
  )

  it('waits for a daily candle close when custom equity combines H1 and D1 symbols', () => {
    const fixture = buildPortfolioFixture(2)
    const prices = fixture.underlyingSeries.map((series) =>
      series.timeframe === 'D1'
        ? series
        : {
            ...series,
            candles: [
              ...series.candles,
              ...series.candles
                .slice(0, 2)
                .map((candle) => ({ ...candle, time: candle.time + 23 * 3600000 })),
            ],
          },
    )
    const result = buildMtmDrawdown(fixture.deals, prices, 1000, {
      sleeves: new Set([fixture.sleeves[0]]),
      includeRealizedFallback: true,
    })
    expect(result?.equity?.index[0].time).toBe(day(0) + 23 * 3600000)
    expect(result?.equity?.index[1].value).toBeCloseTo(0.999)
  })
  it('does not replace a marked equity day with balance when later session hours lack candles', () => {
    const fixture = buildPortfolioFixture(1)
    const deals = [
      ...fixture.deals,
      {
        ...fixture.deals[0],
        deal: 'snapshot',
        time: day(0) + 20 * 3600000,
        entryType: undefined,
        price: undefined,
        volume: undefined,
        _seq: 2,
      },
    ]
    const prices = [
      {
        ...fixture.underlyingSeries[0],
        candles: [{ time: day(0) + 10 * 3600000, open: 100, high: 100, low: 90, close: 90 }],
      },
    ]
    const result = buildMtmDrawdown(deals, prices, 1000, {
      sleeves: new Set(fixture.sleeves),
      sleeveWeights: { [fixture.sleeves[0]]: 2 },
      includeRealizedFallback: true,
    })
    expect(result?.equity?.index[0]).toEqual({ time: day(0) + 10 * 3600000, value: 0.98 })
    expect(result?.equity?.dailyIndex[0].value).toBe(0.98)
    expect(result?.equity?.index.some((point) => point.time === day(0) + 20 * 3600000)).toBe(false)
    expect(result?.realizedFallback?.map((point) => point.time)).toEqual([day(2)])
  })
  it('keeps custom equity through partial candle coverage with one drawdown path and explicit fallback', () => {
    const fixture = buildPortfolioFixture(1)
    const prices = fixture.underlyingSeries.map((series) => ({
      ...series,
      timeframe: 'D1' as const,
      candles: series.candles.slice(1, 2),
    }))
    const result = buildMtmDrawdown(fixture.deals, prices, 1000, {
      sleeves: new Set(fixture.sleeves),
      sleeveWeights: { [fixture.sleeves[0]]: 2 },
      includeRealizedFallback: true,
    })
    expect(result?.equity?.index).toEqual([
      { time: day(0), value: 1 },
      { time: day(1), value: 0.998 },
      { time: day(2), value: 0.998 },
    ])
    expect(result?.equity?.drawdown).toEqual(result?.drawdown)
    expect(result?.realizedFallback?.map((point) => point.time)).toEqual([day(0), day(2)])
    expect(result?.drawdown[1].value).toBeCloseTo(-0.2)
  })

  it('uses preceding baseline account equity as the exposure denominator without attributing its snapshots to sleeves', () => {
    const fixture = buildPortfolioFixture(1)
    const prices = fixture.underlyingSeries.map((series) => ({
      ...series,
      timeframe: 'D1' as const,
      candles: series.candles.map((candle, index) => ({
        ...candle,
        close: index === 1 ? 90 : candle.close,
      })),
    }))
    const result = buildMtmDrawdown(fixture.deals, prices, 1000, {
      sleeves: new Set(fixture.sleeves),
      sleeveWeights: { [fixture.sleeves[0]]: 2 },
      includeRealizedFallback: true,
      baselineEquityIndex: [
        { time: day(0), value: 2 },
        { time: day(1), value: 1.99 },
        { time: day(2), value: 1.999 },
      ],
    })
    expect(result?.equity?.index[0].value).toBe(1)
    expect(result?.equity?.index[1].value).toBeCloseTo(0.99)
    expect(result?.equity?.index[2].value).toBeCloseTo(0.99 * (1 + 18 / 1990))
  })

  it('can value selected sleeves when an unselected symbol is unpriced and the baseline account equity is known', () => {
    const fixture = buildPortfolioFixture(2)
    const result = buildMtmDrawdown(fixture.deals, fixture.underlyingSeries.slice(0, 1), 1000, {
      sleeves: new Set([fixture.sleeves[0]]),
      includeRealizedFallback: true,
      baselineEquityIndex: [
        { time: day(0), value: 1 },
        { time: day(1), value: 0.998 },
        { time: day(2), value: 0.998 },
      ],
    })
    expect(result?.equity?.index[1].value).toBeCloseTo(0.999)
    expect(result?.realizedFallback).toEqual([])
  })
  it('exposes the same marked equity path used for drawdown', () => {
    const { deals, underlyingSeries } = buildPortfolioFixture(1)
    const result = buildMtmDrawdown(deals, underlyingSeries, 1000)
    expect(result?.equity?.index.map((point) => point.value)).toEqual([1, 0.999, 0.999])
    expect(result?.equity?.drawdown).toEqual(result?.drawdown)
    expect(result?.equity?.dailyReturns[1].value).toBeCloseTo(-0.001)
  })

  it('does not expose unpriced or partially covered candles as a complete equity path', () => {
    const { deals, underlyingSeries } = buildPortfolioFixture(2)
    expect(buildMtmDrawdown(deals, underlyingSeries.slice(0, 1), 1000)?.equity).toBeUndefined()
    const partial = underlyingSeries.map((series) => ({
      ...series,
      candles: series.candles.slice(1),
    }))
    expect(buildMtmDrawdown(deals, partial, 1000)?.equity).toBeUndefined()
  })

  it('clips candle observations to the portfolio deal period', () => {
    const deals: DealRow[] = [
      {
        deal: 'open',
        time: day(2),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 0,
        price: 100,
        side: 'buy',
        volume: 1,
        entryType: 'in',
        positionId: 1,
        _seq: 0,
      },
      {
        deal: 'close',
        time: day(3),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 1,
        price: 101,
        volume: 1,
        entryType: 'out',
        profit: 1,
        positionId: 1,
        _seq: 1,
      },
    ]
    const underlyingSeries: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'D1',
        candles: Array.from({ length: 10 }, (_, offset) => ({
          time: day(offset - 3),
          open: 100,
          high: 101,
          low: 100,
          close: 101,
        })),
        daily: [],
      },
    ]

    const result = buildMtmDrawdown(deals, underlyingSeries, 1000)

    expect(result?.drawdown.map((point) => point.time)).toEqual([day(2), day(3)])
    expect(result?.drawdownBySleeve.get('Alpha')?.map((point) => point.time)).toEqual([
      day(2),
      day(3),
    ])
  })

  it('calculates concurrent in-trade drawdown for 10 selected sleeves out of 61', () => {
    const fixture = buildPortfolioFixture(61)
    const selectedSleeves = new Set(fixture.sleeves.slice(0, 10))
    const result = buildMtmDrawdown([...fixture.deals].reverse(), fixture.underlyingSeries, 1000, {
      sleeves: selectedSleeves,
    })

    expect(result?.source).toBe('H1')
    expect(result?.drawdown).toHaveLength(3)
    expect(result?.drawdown[0].value).toBe(0)
    expect(result?.drawdown[1].value).toBeCloseTo(-1)
    expect(result?.drawdown[2].value).toBeCloseTo(-1)
  })

  it('applies unequal weights to concurrent open and realized return contributions', () => {
    const fixture = buildPortfolioFixture(61)
    const selectedSleeves = new Set(fixture.sleeves.slice(0, 10))
    const sleeveWeights = Object.fromEntries(
      fixture.sleeves.slice(0, 10).map((sleeve) => [sleeve, 0.5]),
    )
    sleeveWeights[fixture.sleeves[0]] = 2
    const result = buildMtmDrawdown(fixture.deals, fixture.underlyingSeries, 1000, {
      sleeves: selectedSleeves,
      sleeveWeights,
    })

    expect(result?.drawdown[1].value).toBeCloseTo(-0.65)
    expect(result?.drawdown[2].value).toBeCloseTo(-0.65)
  })

  it('reconciles all sleeves at weight 1 with the baseline MTM drawdown', () => {
    const fixture = buildPortfolioFixture(4)
    const baseline = buildMtmDrawdown(fixture.deals, fixture.underlyingSeries, 1000)
    const weighted = buildMtmDrawdown(fixture.deals, fixture.underlyingSeries, 1000, {
      sleeves: new Set(fixture.sleeves),
      sleeveWeights: Object.fromEntries(fixture.sleeves.map((sleeve) => [sleeve, 1])),
    })

    expect(weighted?.drawdown).toHaveLength(baseline?.drawdown.length ?? 0)
    weighted?.drawdown.forEach((point, index) => {
      expect(point.time).toBe(baseline?.drawdown[index].time)
      expect(point.value).toBeCloseTo(baseline?.drawdown[index].value ?? Number.NaN)
    })
  })

  it('removes a selected sleeve contribution when its weight is zero', () => {
    const fixture = buildPortfolioFixture(2)
    const result = buildMtmDrawdown(fixture.deals, fixture.underlyingSeries, 1000, {
      sleeves: new Set([fixture.sleeves[0]]),
      sleeveWeights: { [fixture.sleeves[0]]: 0 },
    })

    expect(result?.drawdown.map((point) => point.value)).toEqual([0, 0, 0])
  })

  it('applies weights as return exposure instead of scaling historical equity', () => {
    const deals: DealRow[] = [
      {
        deal: 'start',
        time: day(0),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 0,
        _seq: 0,
      },
      {
        deal: 'gain',
        time: day(1),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 100,
        _seq: 1,
      },
      {
        deal: 'loss',
        time: day(2),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: -20,
        _seq: 2,
      },
    ]
    const underlyingSeries: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'D1',
        candles: [0, 1, 2].map((offset) => ({
          time: day(offset),
          open: 100,
          high: 100,
          low: 100,
          close: 100,
        })),
        daily: [],
      },
    ]

    const result = buildMtmDrawdown(deals, underlyingSeries, 100, {
      sleeves: new Set(['Alpha']),
      sleeveWeights: { Alpha: 2 },
    })

    expect(result?.drawdown.map((point) => point.value)).toEqual([0, 0, expect.closeTo(-20)])
  })

  it('measures the first marked loss from starting capital before the position closes', () => {
    const deals: DealRow[] = [
      {
        deal: 'open',
        time: day(0),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 0,
        price: 100,
        side: 'buy',
        volume: 1,
        entryType: 'in',
        positionId: 1,
        _seq: 0,
      },
      {
        deal: 'close',
        time: day(1),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: -10,
        price: 90,
        volume: 1,
        entryType: 'out',
        profit: -10,
        positionId: 1,
        _seq: 1,
      },
    ]
    const underlyingSeries: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'D1',
        candles: [
          { time: day(0), open: 100, high: 100, low: 95, close: 95 },
          { time: day(1), open: 95, high: 95, low: 90, close: 90 },
        ],
        daily: [],
      },
    ]

    const result = buildMtmDrawdown(deals, underlyingSeries, 1000)

    expect(result?.drawdown[0].value).toBeCloseTo(-0.5)
    expect(result?.drawdown[1].value).toBeCloseTo(-1)
  })

  it('does not mark a closed position with a later price from its exit candle', () => {
    const candleHour = Date.UTC(2024, 0, 1, 17)
    const deals: DealRow[] = [
      {
        deal: 'open',
        time: candleHour,
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 0,
        price: 100,
        side: 'sell',
        volume: 1,
        entryType: 'in',
        positionId: 1,
        _seq: 0,
      },
      {
        deal: 'close',
        time: candleHour + 35 * 60 * 1000,
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 2,
        price: 98,
        volume: 1,
        entryType: 'out',
        profit: 2,
        positionId: 1,
        _seq: 1,
      },
    ]
    const underlyingSeries: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'H1',
        candles: [
          { time: candleHour, open: 100, high: 101, low: 90, close: 90 },
          {
            time: candleHour + 60 * 60 * 1000,
            open: 90,
            high: 99,
            low: 90,
            close: 98,
          },
        ],
        daily: [],
      },
    ]

    const result = buildMtmDrawdown(deals, underlyingSeries, 100)

    expect(result?.drawdown.map((point) => point.value)).toEqual([0])
  })
})
