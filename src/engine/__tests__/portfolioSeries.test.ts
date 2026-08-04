import { describe, expect, it } from 'vitest'
import { buildPortfolioReport } from '../portfolioSeries'
import type { DealRow } from '../types'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

const makeDeal = (overrides: Partial<DealRow>): DealRow => ({
  deal: 'D0',
  time: day(0),
  sleeve: 'Core',
  notional: 0,
  _seq: 0,
  ...overrides,
})

describe('buildPortfolioReport', () => {
  it('sets first day denom to NaN', () => {
    const deals = [makeDeal({ deal: 'D1', notional: 10 })]
    const report = buildPortfolioReport(deals, { initialCapital: 100 })
    expect(Number.isNaN(report.portfolio.days[0].denom)).toBe(true)
    expect(Number.isNaN(report.portfolio.days[0].return)).toBe(true)
  })

  it('uses NaN return when denom is <= 0', () => {
    const deals = [
      makeDeal({ deal: 'D1', time: day(0), notional: -5 }),
      makeDeal({ deal: 'D2', time: day(1), notional: 2 }),
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 0 })
    expect(Number.isNaN(report.portfolio.days[1].return)).toBe(true)
  })

  it('treats NaN returns as 0 when compounding index', () => {
    const deals = [
      makeDeal({ deal: 'D1', time: day(0), notional: 0 }),
      makeDeal({ deal: 'D2', time: day(1), notional: 10 }),
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 100 })
    expect(report.portfolio.index[0].value).toBe(1)
    expect(report.portfolio.index[1].value).toBeCloseTo(1.1)
  })

  it('aggregates daily PnL and compounds returns into index and drawdown', () => {
    const deals = [
      makeDeal({ deal: 'D1', time: day(0), notional: 100 }),
      makeDeal({ deal: 'D2', time: day(1), notional: -110 }),
      makeDeal({ deal: 'D3', time: day(2), notional: 220 }),
    ]

    const report = buildPortfolioReport(deals, { initialCapital: 1000 })

    expect(report.portfolio.days.map((item) => item.pnl)).toEqual([100, -110, 220])
    expect(report.portfolio.days.map((item) => item.equity)).toEqual([1100, 990, 1210])
    expect(report.portfolio.days[1].return).toBeCloseTo(-0.1)
    expect(report.portfolio.days[2].return).toBeCloseTo(220 / 990)
    expect(report.portfolio.index[0].value).toBe(1)
    expect(report.portfolio.index[1].value).toBeCloseTo(0.9)
    expect(report.portfolio.index[2].value).toBeCloseTo(1.1)
    expect(report.portfolio.drawdown[0].value).toBe(0)
    expect(report.portfolio.drawdown[1].value).toBeCloseTo(-10)
    expect(report.portfolio.drawdown[2].value).toBe(0)
  })

  it('uses reported balances to calculate subsequent PnL and carries missing balances forward', () => {
    const deals = [
      makeDeal({ deal: 'D1', time: day(0), notional: 25, balance: 1000 }),
      makeDeal({ deal: 'D2', time: day(1), notional: 999, balance: 900 }),
      makeDeal({ deal: 'D3', time: day(2), notional: 50 }),
    ]

    const report = buildPortfolioReport(deals)

    expect(report.portfolio.days.map((item) => item.equity)).toEqual([1000, 900, 900])
    expect(report.portfolio.days.map((item) => item.pnl)).toEqual([25, -100, 0])
    expect(report.portfolio.days[1].return).toBeCloseTo(-0.1)
    expect(report.portfolio.days[2].return).toBe(0)
  })

  it('calculates contribution returns against prior total portfolio equity', () => {
    const deals = [
      makeDeal({
        deal: 'A1',
        time: day(0),
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        notional: 100,
      }),
      makeDeal({
        deal: 'B1',
        time: day(1),
        sleeve: 'Beta',
        symbol: 'USDJPY',
        notional: 55,
      }),
    ]

    const report = buildPortfolioReport(deals, { initialCapital: 1000 })
    const alpha = report.contributions.find((item) => item.sleeve === 'Alpha')
    const beta = report.contributions.find((item) => item.sleeve === 'Beta')

    expect(report.contributions.map((item) => item.key)).toEqual(['Alpha::EURUSD', 'Beta::USDJPY'])
    expect(alpha?.pnl.map((point) => point.value)).toEqual([100, 0])
    expect(beta?.pnl.map((point) => point.value)).toEqual([0, 55])
    expect(Number.isNaN(alpha?.returns[0].value ?? 0)).toBe(true)
    expect(beta?.returns[1].value).toBeCloseTo(0.05)
  })

  it('uses hourly equity for realized drawdown when an H1 source is available', () => {
    const firstHour = Date.UTC(2024, 0, 1, 10)
    const secondHour = Date.UTC(2024, 0, 1, 11)
    const deals = [
      makeDeal({
        deal: 'D1',
        time: firstHour,
        symbol: 'EURUSD',
        notional: 100,
      }),
      makeDeal({
        deal: 'D2',
        time: secondHour,
        symbol: 'EURUSD',
        notional: -50,
      }),
    ]

    const report = buildPortfolioReport(deals, {
      initialCapital: 1000,
      underlyingTimeframes: { 'eur/usd.raw': 'H1' },
    })

    expect(report.portfolio.drawdownSource).toBe('H1')
    expect(report.portfolio.drawdown).toHaveLength(2)
    expect(report.portfolio.drawdown[1].value).toBeCloseTo((1050 / 1100 - 1) * 100)
    expect(report.contributions[0].drawdownSource).toBe('H1')
    expect(report.contributions[0].drawdown).toHaveLength(2)
  })

  it('calculates mark-to-market drawdown after inferring a symbol point value', () => {
    const deals = [
      makeDeal({
        deal: 'A-open',
        time: day(0),
        symbol: 'EURUSD',
        positionId: 1,
        entryType: 'in',
        side: 'buy',
        price: 100,
        volume: 1,
      }),
      makeDeal({
        deal: 'B-close',
        time: day(1),
        symbol: 'EURUSD',
        positionId: 1,
        entryType: 'out',
        price: 110,
        volume: 1,
        profit: 10,
        notional: 10,
      }),
      makeDeal({
        deal: 'C-open',
        time: day(1),
        symbol: 'EURUSD',
        positionId: 2,
        entryType: 'in',
        side: 'buy',
        price: 110,
        volume: 1,
      }),
      makeDeal({
        deal: 'D-period-end',
        time: day(2),
        symbol: 'EURUSD',
        entryType: 'unknown',
        _seq: 3,
      }),
    ]
    const underlyingSeries = [
      {
        symbol: 'EURUSD',
        timeframe: 'D1' as const,
        candles: [
          { time: day(0), open: 100, high: 100, low: 100, close: 100 },
          { time: day(1), open: 110, high: 110, low: 110, close: 110 },
          { time: day(2), open: 100, high: 100, low: 100, close: 100 },
        ],
        daily: [],
      },
    ]

    const report = buildPortfolioReport(deals, {
      initialCapital: 1000,
      underlyingSeries,
    })

    expect(report.portfolio.drawdownMtmSource).toBe('D1')
    expect(report.portfolio.drawdownMtm).toHaveLength(3)
    expect(report.portfolio.drawdownMtm?.map((point) => point.value)).toEqual([
      0,
      0,
      expect.closeTo((1000 / 1010 - 1) * 100),
    ])
    expect(report.contributions[0].drawdownMtm?.at(-1)?.value).toBeCloseTo((1 / 1.01 - 1) * 100)
  })

  it('preserves report metadata and derives symbols from sleeve labels', () => {
    const report = buildPortfolioReport(
      [makeDeal({ sleeve: 'Core - XAUUSD', symbol: undefined })],
      { generatedAt: 1234, dealsSourceName: 'deals.csv' },
    )

    expect(report.generatedAt).toBe(1234)
    expect(report.dealsSourceName).toBe('deals.csv')
    expect(report.contributions[0].symbol).toBe('XAUUSD')
  })
})
