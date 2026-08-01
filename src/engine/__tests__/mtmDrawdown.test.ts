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

    expect(result?.drawdown.map((point) => point.value)).toEqual([0, 0])
  })
})
