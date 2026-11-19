import { describe, expect, it } from 'vitest'
import { reconstructPortfolioEquity } from '../reconstructPortfolioEquity'
import { buildPortfolioReport } from '../portfolioSeries'
import type { DealRow, UnderlyingSeries } from '../types'

const HOUR = 3600000
const start = Date.UTC(2024, 0, 1, 1)
const deal = (seq: number, overrides: Partial<DealRow>): DealRow => ({
  deal: String(seq),
  time: start,
  sleeve: 'Hedge',
  symbol: 'EURUSD',
  notional: 0,
  balance: 1000,
  equity: 950,
  _seq: seq,
  ...overrides,
})
const deals = [
  deal(0, {
    time: start - HOUR + 1000,
    entryType: 'in',
    side: 'buy',
    price: 100,
    volume: 2,
    positionId: 1,
  }),
  deal(1, {
    time: start - HOUR + 1000,
    entryType: 'in',
    side: 'sell',
    price: 100,
    volume: 1,
    positionId: 2,
  }),
  deal(2, { time: start + 2 * HOUR + 1000, equity: 960 }),
  deal(3, {
    time: start + 5 * HOUR,
    entryType: 'out',
    price: 110,
    volume: 2,
    positionId: 1,
    profit: 20,
    notional: 20,
    balance: 1020,
    equity: 960,
  }),
  deal(4, {
    time: start + 5 * HOUR,
    entryType: 'out',
    price: 110,
    volume: 1,
    positionId: 2,
    profit: -10,
    notional: -10,
    balance: 1010,
    equity: 960,
  }),
]
const underlying = (offsets = [0, 1, 2, 3]): UnderlyingSeries[] => [
  {
    symbol: 'EURUSD',
    timeframe: 'H1',
    daily: [],
    candles: offsets.map((hour) => ({
      time: start + hour * HOUR,
      open: 100,
      high: 120,
      low: 80,
      close: [80, 120, 90, 110][hour] ?? 100,
    })),
  },
]

describe('snapshot-anchored equity reconstruction', () => {
  it('marks candle-covered trading days consistently instead of switching color at each intraday snapshot', () => {
    const day = Date.UTC(2024, 0, 1)
    const snapshots = [
      deal(0, {
        time: day + 9 * HOUR,
        equity: 1000,
        entryType: 'in',
        side: 'buy',
        price: 100,
        volume: 1,
        positionId: 1,
      }),
      deal(1, { time: day + 22 * HOUR, equity: 995 }),
      deal(2, { time: day + 24 * HOUR + 12 * HOUR, equity: 990 }),
      deal(3, {
        time: day + 48 * HOUR + 22 * HOUR,
        equity: 1010,
        entryType: 'out',
        price: 110,
        volume: 1,
        positionId: 1,
        profit: 10,
        notional: 10,
      }),
    ]
    const prices: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'H1',
        daily: [],
        candles: [0, 1].map((offset) => ({
          time: day + offset * 24 * HOUR + 10 * HOUR,
          open: 100,
          high: 100,
          low: 100,
          close: 100,
        })),
      },
    ]
    const result = reconstructPortfolioEquity(snapshots, prices, 1000)
    expect(result?.recordedOnlyDrawdown?.map((point) => point.time)).toEqual([snapshots[3].time])
    // Coverage color must not fabricate observations in the unpriced session hours.
    expect(result?.index.find((point) => point.time === snapshots[1].time)?.value).toBe(0.995)
    expect(result?.index.find((point) => point.time === snapshots[2].time)?.value).toBe(0.99)
    expect(result?.index.some((point) => point.time === day + 23 * HOUR)).toBe(false)
  })
  it('fills missing hours without inventing extra extremes in already observed hours', () => {
    const observed = [
      deal(0, {
        time: start,
        equity: 1000,
        entryType: 'in',
        side: 'buy',
        price: 100,
        volume: 1,
        positionId: 1,
      }),
      deal(1, { time: start + HOUR - 1000, equity: 990 }),
      deal(2, { time: start + HOUR, equity: 995 }),
      deal(3, {
        time: start + 3 * HOUR,
        equity: 1010,
        entryType: 'out',
        price: 110,
        volume: 1,
        positionId: 1,
        profit: 10,
        notional: 10,
      }),
    ]
    const result = reconstructPortfolioEquity(observed, underlying([0, 1, 2]), 1000)
    expect(result?.index.some((point) => point.time === start + HOUR - 1)).toBe(false)
    expect(result?.index.some((point) => point.time === start + 2 * HOUR - 1)).toBe(false)
    // Native equity at the closing boundary also replaces a would-be estimate one ms earlier.
    expect(result?.index.some((point) => point.time === start + 3 * HOUR - 1)).toBe(false)
    expect(result?.index).toHaveLength(observed.length)
    expect(Math.min(...(result?.drawdown.map((point) => point.value) ?? []))).toBeCloseTo(-1)
  })
  it('fills hours without deals from equity, accounts for both hedge legs, and resets at native snapshots', () => {
    const result = reconstructPortfolioEquity(deals, underlying(), 1000)
    expect(result?.source).toBe('recorded+H1')
    expect(result?.index.map((point) => point.value)).toEqual([
      0.95, 0.95, 0.93, 0.97, 0.96, 0.97, 0.96, 0.96,
    ])
    expect(result?.index[2].time).toBe(start + HOUR - 1)
    // A single high-water mark includes the initial capital, not the balance or a per-source peak.
    expect(result?.drawdown[2].value).toBeCloseTo(-7)
    expect(result?.drawdown[5].value).toBeCloseTo(-3)
    expect(result?.dailyIndex[0].value).toBe(0.96)
    expect(result?.dailyReturns[0].value).toBeCloseTo(-0.04)
    expect(result?.recordedOnlyDrawdown).toEqual([])
    const report = buildPortfolioReport(deals, {
      initialCapital: 1000,
      underlyingSeries: underlying(),
    })
    expect(report.portfolio.equity).toEqual(result)
    expect(report.portfolio.drawdownMtm).toEqual(result?.drawdown)
    expect(report.portfolio.days.at(-1)?.equity).toBe(1010)
  })

  it('retains recorded equity through missing candle hours without extrapolating an estimate', () => {
    const result = reconstructPortfolioEquity(deals, underlying([0, 2]), 1000)
    expect(result?.index.some((point) => point.time === start + 2 * HOUR - 1)).toBe(false)
    // An observed hour keeps its native snapshot even when a candle exists.
    expect(result?.index.find((point) => point.time === start + 3 * HOUR - 1)).toBeUndefined()
    expect(result?.recordedOnlyDrawdown?.some((point) => point.time === deals[2].time)).toBe(false)
    expect(result?.index.at(-1)?.value).toBe(0.96)
  })

  it('does not expand observation bounds and assigns period-end events to the next candle', () => {
    const extra = underlying([-100, 0, 1, 2, 100])
    const boundaryDeals = [...deals, deal(5, { time: start + HOUR, equity: 940 })]
    const result = reconstructPortfolioEquity(boundaryDeals, extra, 1000)
    expect(result?.index[0].time).toBe(start - HOUR + 1000)
    expect(result?.index.at(-1)?.time).toBe(start + 5 * HOUR)
    expect(result?.index.find((point) => point.time === start + HOUR - 1)).toBeUndefined()
    expect(result?.index.find((point) => point.time === start + HOUR)?.value).toBe(0.94)
  })

  it('never uses an incomplete hedge book as a candle valuation', () => {
    const other = [
      ...deals,
      deal(6, {
        entryType: 'in',
        side: 'sell',
        symbol: 'GBPUSD',
        price: 100,
        volume: 1,
        positionId: 3,
      }),
    ]
    const result = reconstructPortfolioEquity(other, underlying(), 1000)
    expect(result?.source).toBe('deal-snapshots')
    expect(result?.index).toHaveLength(other.length)
    expect(result?.recordedOnlyDrawdown).toEqual(
      result?.drawdown.filter((point) => point.time >= start),
    )
  })

  it('keeps the previous equity anchor across a deal with no snapshot, including cash and floating changes', () => {
    const sparse = deals.map((point) => ({ ...point }))
    sparse[2] = {
      ...sparse[2],
      equity: undefined,
      entryType: 'out',
      price: 90,
      volume: 0.5,
      positionId: 1,
      profit: -5,
      notional: -5,
    }
    sparse[3] = { ...sparse[3], volume: 1.5, profit: 15, notional: 15 }
    const result = reconstructPortfolioEquity(sparse, underlying(), 1000)
    expect(result?.index.some((point) => point.time === sparse[2].time)).toBe(false)
    expect(result?.index.find((point) => point.time === start + 3 * HOUR - 1)?.value).toBe(0.94)
    expect(result?.index.at(-1)?.value).toBe(0.96)
    const nativeOnly = reconstructPortfolioEquity(sparse, [], 1000)
    expect(nativeOnly?.index).toHaveLength(4)
  })

  it('uses each candle timeframe end and never an hourly end for a daily price', () => {
    const extended = deals.map((point) => ({
      ...point,
      time: point._seq >= 3 ? start + 49 * HOUR : point.time,
    }))
    const daily: UnderlyingSeries = {
      symbol: 'EURUSD',
      timeframe: 'D1',
      daily: [],
      candles: [0, 1].map((day) => ({
        time: start + day * 24 * HOUR,
        open: 100,
        high: 110,
        low: 80,
        close: 80,
      })),
    }
    const result = reconstructPortfolioEquity(extended, [daily], 1000)
    expect(result?.source).toBe('recorded+D1')
    expect(result?.index.find((point) => point.time === start + 48 * HOUR - 1)?.value).toBe(0.94)
    expect(result?.index.some((point) => point.time === start + HOUR - 1)).toBe(false)
  })
})
