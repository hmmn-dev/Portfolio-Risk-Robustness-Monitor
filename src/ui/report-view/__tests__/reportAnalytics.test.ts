import { describe, expect, it } from 'vitest'
import { createReport } from '../../../test/reportFixtures'
import {
  buildCorrelationMatrix,
  buildPerformanceRows,
  buildPortfolioSummary,
  buildReportObfuscation,
  normalizeUnderlyingBySymbol,
  obfuscatePerformanceRows,
  resolvePortfolioDrawdown,
  resolvePortfolioDrawdownFallback,
  resolveSleeveDrawdown,
} from '../reportAnalytics'

describe('report analytics', () => {
  it('builds deterministic performance rows without changing financial units', () => {
    const rows = buildPerformanceRows(createReport())

    expect(rows.map(({ sleeve, symbol }) => ({ sleeve, symbol }))).toEqual([
      { sleeve: 'Alpha', symbol: 'EURUSD' },
      { sleeve: 'Beta', symbol: 'USDJPY' },
    ])
    expect(rows[0].totalPnl).toBe(75)
    expect(rows[0].meanAnn).toBeCloseTo(-63)
  })

  it('selects MTM drawdown only when it is available', () => {
    const report = createReport()
    const mtm = [{ time: report.portfolio.drawdown[0].time, value: -12 }]
    report.portfolio.drawdownMtm = mtm
    report.contributions[0].drawdownMtm = mtm

    expect(resolvePortfolioDrawdown(report, 'mtm')).toEqual([mtm[0], report.portfolio.drawdown[1]])
    expect(resolvePortfolioDrawdownFallback(report, 'mtm')).toEqual([report.portfolio.drawdown[1]])
    expect(resolveSleeveDrawdown(report.contributions[0], 'mtm')).toBe(mtm)

    delete report.portfolio.drawdownMtm
    delete report.contributions[0].drawdownMtm

    expect(resolvePortfolioDrawdown(report, 'mtm')).toBe(report.portfolio.drawdown)
    expect(resolvePortfolioDrawdownFallback(report, 'mtm')).toEqual([])
    expect(resolveSleeveDrawdown(report.contributions[0], 'mtm')).toBe(
      report.contributions[0].drawdown,
    )
  })

  it('builds portfolio summaries and null-safe correlation matrices', () => {
    const report = createReport()
    const normalizedUnderlying = normalizeUnderlyingBySymbol({})
    const summary = buildPortfolioSummary(report, report.portfolio.drawdown, normalizedUnderlying)
    const matrix = buildCorrelationMatrix(report)

    expect(summary.totalReturnPct).toBeCloseTo((10050 / 10100 - 1) * 100)
    expect(summary.maxDrawdown).toBeCloseTo((10050 / 10100 - 1) * 100)
    expect(summary.regression).toBeNull()
    expect(matrix.labels).toEqual(['Alpha - EURUSD', 'Beta - USDJPY'])
    expect(matrix.values).toEqual([
      [null, null],
      [null, null],
    ])
  })

  it('obfuscates labels without mutating source rows', () => {
    const report = createReport()
    const rows = buildPerformanceRows(report)
    const obfuscation = buildReportObfuscation(report, null)
    const obfuscated = obfuscatePerformanceRows(rows, obfuscation)

    expect(obfuscated[0]).toMatchObject({
      sleeve: 'SLEEVE-01',
      symbol: 'SYM-01',
      totalPnl: rows[0].totalPnl,
    })
    expect(rows[0]).toMatchObject({ sleeve: 'Alpha', symbol: 'EURUSD' })
  })
})
