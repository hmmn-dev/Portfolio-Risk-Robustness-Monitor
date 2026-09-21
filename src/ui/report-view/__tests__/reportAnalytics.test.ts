import { describe, expect, it } from 'vitest'
import type { ReportModel } from '../../../engine/types'
import { createReport } from '../../../test/reportFixtures'
import {
  buildCorrelationMatrix,
  buildPerformanceRows,
  buildPortfolioSummary,
  buildReportObfuscation,
  buildRiskRows,
  normalizeUnderlyingBySymbol,
  obfuscatePerformanceRows,
  resolvePortfolioDrawdown,
  resolvePortfolioDrawdownFallback,
  resolveSleeveDrawdown,
} from '../reportAnalytics'

const DAY_MS = 24 * 60 * 60 * 1000
const riskDay = (offset: number) => Date.UTC(2020, 0, 1) + offset * DAY_MS

const createRiskReport = (length: number, activeIndices: Set<number>): ReportModel => {
  const times = Array.from({ length }, (_, index) => riskDay(index))
  const returns = times.map((time, index) => ({
    time,
    value: activeIndices.has(index) ? 0.002 + (index % 3) * 0.0002 : 0,
  }))

  return {
    generatedAt: times[times.length - 1],
    portfolio: {
      days: times.map((time, index) => ({
        time,
        pnl: 0,
        equity: 100_000,
        denom: 100_000,
        return: index % 2 === 0 ? 0.001 : -0.0005,
      })),
      index: times.map((time) => ({ time, value: 1 })),
      drawdown: times.map((time) => ({ time, value: 0 })),
    },
    contributions: [
      {
        key: 'Sparse::SPY',
        sleeve: 'Sparse - SPY',
        symbol: 'SPY',
        pnl: times.map((time) => ({ time, value: 0 })),
        returns,
        index: times.map((time) => ({ time, value: 1 })),
        drawdown: times.map((time) => ({ time, value: 0 })),
      },
    ],
  }
}

const buildPortfolioReturnMap = (report: ReportModel) =>
  new Map(report.portfolio.days.map((item) => [item.time, item.return]))

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
      sleeve: 'STRATEGY-01',
      symbol: 'SYM-01',
      totalPnl: rows[0].totalPnl,
    })
    expect(rows[0]).toMatchObject({ sleeve: 'Alpha', symbol: 'EURUSD' })
  })

  it('presents a bucket as one strategy without exposing a member symbol', () => {
    const report = createReport()
    report.contributions = [
      {
        ...report.contributions[0],
        key: 'bucket::Daily Capitulation MR - EQ',
        sleeve: 'Daily Capitulation MR - EQ',
        symbol: '',
        grouping: {
          kind: 'bucket',
          name: 'EQ',
          strategy: 'Daily Capitulation MR',
          members: [
            {
              key: 'Daily Capitulation MR [EQ] - SPY::SPY',
              sleeve: 'Daily Capitulation MR [EQ] - SPY',
              symbol: 'SPY',
            },
            {
              key: 'Daily Capitulation MR [EQ] - QQQ::QQQ',
              sleeve: 'Daily Capitulation MR [EQ] - QQQ',
              symbol: 'QQQ',
            },
          ],
        },
      },
    ]

    const performanceRow = buildPerformanceRows(report)[0]
    const riskRow = buildRiskRows(report, 'deal', {}, buildPortfolioReturnMap(report))[0]
    const obfuscation = buildReportObfuscation(report, null)

    expect(performanceRow).toMatchObject({ sleeve: 'Daily Capitulation MR - EQ', symbol: '' })
    expect(riskRow).toMatchObject({ sleeve: 'Daily Capitulation MR - EQ', symbol: '' })
    expect(obfuscation.formatSleeveLabel('Daily Capitulation MR - EQ')).toBe('STRATEGY-01')
  })

  it('supports sparse sleeves with 30 active observations in the current two-year window', () => {
    const report = createRiskReport(
      563,
      new Set(Array.from({ length: 30 }, (_, index) => 503 + index)),
    )
    const row = buildRiskRows(report, 'deal', {}, buildPortfolioReturnMap(report))[0]

    expect(row.alphaEvidence).toMatchObject({
      state: 'CURRENT',
      source: 'PORTFOLIO',
      activeObservations: 30,
      requiredActiveObservations: 30,
    })
    expect(row.alphaPct).not.toBeNull()
    expect(row.status).not.toBe('UNKNOWN')
  })

  it('reports insufficient evidence instead of reusing a stale alpha value', () => {
    const report = createRiskReport(650, new Set(Array.from({ length: 61 }, (_, index) => index)))
    const row = buildRiskRows(report, 'deal', {}, buildPortfolioReturnMap(report))[0]

    expect(row.status).toBe('UNKNOWN')
    expect(row.alphaPct).toBeNull()
    expect(row.alphaEvidence.state).toBe('INSUFFICIENT')
    expect(row.alphaEvidence.lastValidTime).not.toBeNull()
    expect(row.alphaEvidence.lastValidTime).toBeLessThan(row.alphaEvidence.reportTime as number)
  })

  it('uses portfolio returns when underlying coverage misses the current window', () => {
    const report = createRiskReport(
      600,
      new Set(Array.from({ length: 41 }, (_, index) => 100 + index)),
    )
    const underlying = Array.from({ length: 450 }, (_, index) => ({
      symbol: 'SPY',
      time: riskDay(index),
      close: 100 + index,
      return: index % 2 === 0 ? 0.001 : -0.0005,
    }))
    const row = buildRiskRows(
      report,
      'deal',
      { SPY: underlying },
      buildPortfolioReturnMap(report),
    )[0]

    expect(row.alphaEvidence.source).toBe('PORTFOLIO')
    expect(row.alphaEvidence.state).toBe('CURRENT')
  })

  it('does not reinterpret a bucket name as a single underlying symbol', () => {
    const report = createRiskReport(
      563,
      new Set(Array.from({ length: 30 }, (_, index) => 503 + index)),
    )
    report.contributions[0] = {
      ...report.contributions[0],
      key: 'bucket::Sparse - EQ',
      sleeve: 'Sparse - EQ',
      symbol: '',
      grouping: {
        kind: 'bucket',
        name: 'EQ',
        strategy: 'Sparse',
        members: [
          { key: 'Sparse [EQ] - SPY::SPY', sleeve: 'Sparse [EQ] - SPY', symbol: 'SPY' },
          { key: 'Sparse [EQ] - QQQ::QQQ', sleeve: 'Sparse [EQ] - QQQ', symbol: 'QQQ' },
        ],
      },
    }
    const fakeEqUnderlying = report.portfolio.days.map((day) => ({
      symbol: 'EQ',
      time: day.time,
      close: 100,
      return: day.return,
    }))

    const row = buildRiskRows(
      report,
      'deal',
      { EQ: fakeEqUnderlying },
      buildPortfolioReturnMap(report),
    )[0]

    expect(row.alphaEvidence.source).toBe('PORTFOLIO')
  })
})
