import { describe, expect, it } from 'vitest'
import { buildPortfolioReport } from '../portfolioSeries'
import {
  resolvePortfolioDrawdownSeries,
  resolvePortfolioDrawdownSource,
} from '../portfolioDrawdown'

it('keeps the equity path and its provenance without inserting realized balance drawdown', () => {
  const report = buildPortfolioReport(
    [{ deal: '1', time: 0, sleeve: 'Core', notional: 0, equity: 900, balance: 1000, _seq: 0 }],
    { initialCapital: 1000 },
  )
  expect(resolvePortfolioDrawdownSeries(report, 'mtm')).toEqual({
    drawdown: report.portfolio.equity?.drawdown,
    realizedFallback: report.portfolio.equity?.drawdown,
  })
  expect(resolvePortfolioDrawdownSource(report, 'mtm')).toBe('deal-snapshots')
  expect(resolvePortfolioDrawdownSeries(report, 'deal').drawdown).toEqual(report.portfolio.drawdown)
})

describe('legacy candle-only reports', () => {
  it('retains explicitly realized fallback outside candle coverage', () => {
    const report = buildPortfolioReport(
      [0, 1, 2, 3].map((i) => ({
        deal: String(i),
        time: i * 86400000,
        sleeve: 'Core',
        notional: 0,
        _seq: i,
      })),
    )
    report.portfolio.drawdownMtm = [
      { time: 86400000, value: -4 },
      { time: 172800000, value: -5 },
    ]
    report.portfolio.drawdownMtmSource = 'H1'
    expect(resolvePortfolioDrawdownSeries(report, 'mtm').realizedFallback).toHaveLength(2)
  })
})
