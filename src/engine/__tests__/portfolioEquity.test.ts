import { describe, expect, it } from 'vitest'
import { buildPortfolioEquity, buildRecordedPortfolioEquity } from '../portfolioEquity'
import { buildPortfolioReport } from '../portfolioSeries'
import { resolvePortfolioPerformance } from '../portfolioPerformance'
import type { DealRow } from '../types'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)
const deal = (overrides: Partial<DealRow>): DealRow => ({
  deal: '1',
  time: day(0),
  sleeve: 'Core',
  notional: 0,
  _seq: 0,
  ...overrides,
})

describe('recorded portfolio equity', () => {
  it('includes floating hedge PnL while keeping realized contributions unchanged', () => {
    const deals = [
      deal({ balance: 1000, equity: 990 }),
      deal({ deal: '2', time: day(1), balance: 1200, equity: 1010, notional: 200, _seq: 1 }),
      deal({
        deal: '3',
        time: day(1) + 1000,
        balance: 1100,
        equity: 1000,
        notional: -100,
        _seq: 2,
      }),
      deal({ deal: '4', time: day(2), balance: 1100, equity: 1020, _seq: 3 }),
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 1000 })
    const withoutEquity = buildPortfolioReport(
      deals.map((item) => ({ ...item, equity: undefined })),
      { initialCapital: 1000 },
    )
    expect(report.portfolio.equity?.source).toBe('deal-snapshots')
    expect(report.portfolio.equity?.index.map((point) => point.value)).toEqual([
      0.99, 1.01, 1, 1.02,
    ])
    expect(report.portfolio.equity?.dailyIndex.map((point) => point.value)).toEqual([0.99, 1, 1.02])
    expect(report.portfolio.equity?.dailyReturns[1].value).toBeCloseTo(1000 / 990 - 1)
    expect(report.portfolio.drawdownMtm?.[0].value).toBeCloseTo(-1)
    expect(report.portfolio.drawdownMtm?.[2].value).toBeCloseTo((1000 / 1010 - 1) * 100)
    expect(report.portfolio.days).toEqual(withoutEquity.portfolio.days)
    expect(report.portfolio.index).toEqual(withoutEquity.portfolio.index)
    expect(report.contributions).toEqual(withoutEquity.contributions)
    expect(resolvePortfolioPerformance(report, true).chartIndex).toEqual(
      report.portfolio.equity?.index,
    )
    expect(resolvePortfolioPerformance(report, false).chartIndex).toEqual(report.portfolio.index)
  })

  it('preserves the exported sequence for conflicting snapshots at one timestamp', () => {
    const series = buildRecordedPortfolioEquity(
      [deal({ deal: '2', equity: 900, _seq: 2 }), deal({ deal: '10', equity: 1100, _seq: 1 })],
      1000,
    )
    expect(series?.index.map((point) => point.value)).toEqual([1.1, 0.9])
    expect(series?.dailyIndex[0].value).toBe(0.9)
    expect(series?.drawdown[1].value).toBeCloseTo((900 / 1100 - 1) * 100)
  })

  it.each([undefined, NaN, Infinity])('rejects incomplete or invalid snapshots: %s', (equity) => {
    expect(
      buildRecordedPortfolioEquity([deal({ equity: 1000 }), deal({ equity })], 1000),
    ).toBeUndefined()
  })

  it('handles empty, constant, one-point, zero and negative equity without inventing health', () => {
    expect(buildPortfolioEquity([], 1000, 'deal-snapshots')).toBeUndefined()
    expect(
      buildPortfolioEquity([{ time: day(0), value: 1000 }], 0, 'deal-snapshots'),
    ).toBeUndefined()
    const series = buildPortfolioEquity(
      [
        { time: day(0), value: 1000 },
        { time: day(1), value: 1000 },
        { time: day(2), value: 0 },
        { time: day(3), value: -100 },
      ],
      1000,
      'deal-snapshots',
    )
    expect(series?.drawdown.map((point) => point.value)).toEqual([0, 0, -100, expect.closeTo(-110)])
    expect(series?.dailyReturns[3].value).toBeNaN()
    expect(
      buildPortfolioEquity([{ time: day(0), value: 900 }], 1000, 'deal-snapshots')?.drawdown[0]
        .value,
    ).toBeCloseTo(-10)
  })
})
