import { describe, expect, it } from 'vitest'
import { buildPortfolioReport } from '../portfolioSeries'
import type { DealRow } from '../types'

const makeDeal = (overrides: Partial<DealRow>): DealRow => ({
  deal: overrides.deal ?? 'D0',
  time: overrides.time ?? 1,
  sleeve: overrides.sleeve ?? 'Core',
  notional: overrides.notional ?? 0,
  _seq: overrides._seq ?? 0,
  symbol: overrides.symbol,
  balance: overrides.balance,
})

describe('buildPortfolioReport', () => {
  it('sets first day denom to NaN', () => {
    const deals = [makeDeal({ deal: 'D1', time: 1, notional: 10 })]
    const report = buildPortfolioReport(deals, { initialCapital: 100 })
    expect(Number.isNaN(report.portfolio.days[0].denom)).toBe(true)
    expect(Number.isNaN(report.portfolio.days[0].return)).toBe(true)
  })

  it('uses NaN return when denom is <= 0', () => {
    const deals = [
      makeDeal({ deal: 'D1', time: 1, notional: -5 }),
      makeDeal({ deal: 'D2', time: 2, notional: 2 }),
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 0 })
    expect(Number.isNaN(report.portfolio.days[1].return)).toBe(true)
  })

  it('treats NaN returns as 0 when compounding index', () => {
    const deals = [
      makeDeal({ deal: 'D1', time: 1, notional: 0 }),
      makeDeal({ deal: 'D2', time: 2, notional: 10 }),
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 100 })
    expect(report.portfolio.index[0].value).toBe(1)
    expect(report.portfolio.index[1].value).toBeCloseTo(1.1)
  })
})
