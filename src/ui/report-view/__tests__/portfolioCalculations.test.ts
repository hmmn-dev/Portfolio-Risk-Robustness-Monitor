import { describe, expect, it } from 'vitest'
import { createReport } from '../../../test/reportFixtures'
import {
  applyDrawdownToSummary,
  buildContributionCorrelationMatrix,
  buildCustomPortfolioSummary,
  buildDailyReturnPoints,
  buildIndexAndDrawdown,
  buildMonthlyReturnRows,
  buildRangePortfolioSummary,
  buildWeightedPortfolio,
} from '../portfolio/portfolioCalculations'
import {
  buildDefaultWeights,
  countModifiedWeights,
  normalizeWeightDraft,
  resolveGlobalWeightDraft,
} from '../portfolio/portfolioWeights'

describe('portfolio calculations', () => {
  it('compounds index, drawdown, and monthly return rows deterministically', () => {
    const returns = [
      { time: Date.UTC(2024, 0, 2), value: 0.1 },
      { time: Date.UTC(2024, 0, 3), value: -0.2 },
      { time: Date.UTC(2024, 1, 1), value: 0.05 },
    ]
    const series = buildIndexAndDrawdown(returns)
    const rows = buildMonthlyReturnRows(returns, series.drawdown)

    expect(series.index[0].value).toBeCloseTo(1.1)
    expect(series.index[1].value).toBeCloseTo(0.88)
    expect(series.index[2].value).toBeCloseTo(0.924)
    expect(series.drawdown.at(-1)?.value).toBeCloseTo(-16)
    expect(rows).toHaveLength(1)
    expect(rows[0].months[0]).toBeCloseTo(-0.12)
    expect(rows[0].months[1]).toBeCloseTo(0.05)
    expect(rows[0].total).toBeCloseTo(-0.076)
    expect(rows[0].maxDrawdown).toBeCloseTo(-20)
  })

  it('rebuilds a weighted portfolio without mutating report contributions', () => {
    const report = createReport()
    const source = structuredClone(report.contributions)
    const weighted = buildWeightedPortfolio(
      report.portfolio.days,
      report.contributions.slice(0, 1),
      { [report.contributions[0].sleeve]: 0.5 },
    )

    expect(weighted.returns).toEqual([0, -0.00125])
    expect(report.contributions).toEqual(source)
    expect(buildCustomPortfolioSummary(weighted).regression).toBeNull()
  })

  it('applies unequal weights to each baseline return contribution', () => {
    const times = [Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 2), Date.UTC(2024, 0, 3)]
    const portfolioDays = times.map((time, index) => ({
      time,
      pnl: [0, 0, -100][index],
      equity: [1000, 1000, 900][index],
      denom: index === 0 ? Number.NaN : [Number.NaN, 1000, 1000][index],
      return: index === 0 ? Number.NaN : [Number.NaN, 0, -0.1][index],
    }))
    const contributions = [
      {
        key: 'Alpha::EURUSD',
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        pnl: times.map((time, index) => ({ time, value: [0, 100, -100][index] })),
        returns: times.map((time, index) => ({
          time,
          value: [Number.NaN, 0.1, -0.1][index],
        })),
        index: [],
        drawdown: [],
      },
      {
        key: 'Beta::USDJPY',
        sleeve: 'Beta',
        symbol: 'USDJPY',
        pnl: times.map((time, index) => ({ time, value: [0, -100, 0][index] })),
        returns: times.map((time, index) => ({
          time,
          value: [Number.NaN, -0.1, 0][index],
        })),
        index: [],
        drawdown: [],
      },
    ]

    const weighted = buildWeightedPortfolio(portfolioDays, contributions, {
      Alpha: 2,
      Beta: 0.5,
    })

    expect(weighted.returns[0]).toBe(0)
    expect(weighted.returns[1]).toBeCloseTo(0.15)
    expect(weighted.returns[2]).toBeCloseTo(-0.2)
    expect(weighted.index.at(-1)?.value).toBeCloseTo(0.92)
    expect(weighted.drawdown.at(-1)?.value).toBeCloseTo(-20)
  })

  it('preserves every contribution when a sleeve contains multiple symbols', () => {
    const report = createReport()
    const duplicateSleeveContributions = report.contributions.map((contribution, index) => ({
      ...contribution,
      key: `${contribution.sleeve}::symbol-${index}`,
      sleeve: 'Shared sleeve',
    }))

    const weighted = buildWeightedPortfolio(report.portfolio.days, duplicateSleeveContributions, {
      'Shared sleeve': 2,
    })

    weighted.returns.forEach((actualReturn, index) => {
      const expected = duplicateSleeveContributions.reduce((total, contribution) => {
        const value = contribution.returns[index]?.value
        return total + (Number.isFinite(value) ? value * 2 : 0)
      }, 0)
      expect(actualReturn).toBeCloseTo(expected)
    })
  })

  it('builds correlation and applies the effective drawdown to a summary', () => {
    const report = createReport()
    const matrix = buildContributionCorrelationMatrix(report.contributions)
    const summary = buildCustomPortfolioSummary(
      buildWeightedPortfolio(
        report.portfolio.days,
        report.contributions,
        buildDefaultWeights(report.contributions.map((item) => item.sleeve)),
      ),
    )
    const effective = applyDrawdownToSummary(summary, [{ time: 1, value: -25 }])

    expect(matrix.labels).toEqual(['Alpha - EURUSD', 'Beta - USDJPY'])
    expect(effective?.maxDrawdown).toBe(-25)
    expect(effective?.mar).toBeCloseTo(summary.cagr / 25)
    expect(buildDailyReturnPoints(report.portfolio.days)).toEqual(
      report.portfolio.days.map((day) => ({ time: day.time, value: day.return })),
    )
  })

  it('recalculates summary metrics from only the selected daily returns', () => {
    const returns = [
      { time: Date.UTC(2024, 0, 1), value: 0.1 },
      { time: Date.UTC(2025, 0, 1), value: -0.05 },
    ]
    const summary = buildRangePortfolioSummary(
      returns,
      [
        { time: Date.UTC(2024, 0, 1), value: 0 },
        { time: Date.UTC(2025, 0, 1), value: -5 },
      ],
      null,
    )

    expect(summary.totalReturnPct).toBeCloseTo(4.5)
    expect(summary.cagr).toBeCloseTo(4.5, 1)
    expect(summary.maxDrawdown).toBe(-5)
    expect(summary.mar).toBeCloseTo(summary.cagr / 5)
    expect(Number.isFinite(summary.sharpe)).toBe(true)
  })

  it('normalizes and compares portfolio weight drafts', () => {
    const labels = ['Alpha', 'Beta']
    expect(resolveGlobalWeightDraft({ Alpha: '0.50', Beta: '0.50' }, labels)).toBe('0.50')
    expect(resolveGlobalWeightDraft({ Alpha: '0.50', Beta: '1.00' }, labels)).toBe('')
    expect(normalizeWeightDraft(labels, { Alpha: '0.126', Beta: '' })).toEqual({
      Alpha: 0.13,
      Beta: 0,
    })
    expect(countModifiedWeights(labels, { Alpha: 1, Beta: 0.5 })).toBe(1)
  })
})
