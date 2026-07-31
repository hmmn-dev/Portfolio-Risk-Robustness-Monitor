import { describe, expect, it } from 'vitest'
import {
  buildPortfolioStatusCounts,
  buildPortfolioSummaryMetrics,
  computeDailySqn,
  computeLongestStagnationDays,
} from '../portfolio/portfolioSummaryMetrics'
import type { PortfolioSummary, RiskRow } from '../types'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

const summary: PortfolioSummary = {
  totalReturnPct: 20,
  cagr: 10,
  maxDrawdown: -5,
  mar: 2,
  sharpe: 1,
  regression: null,
}

describe('portfolio summary metrics', () => {
  it('calculates daily SQN with sample deviation and rejects insufficient variation', () => {
    const returns = [0.02, -0.01, 0.03].map((value, index) => ({ time: day(index), value }))
    const mean = returns.reduce((total, point) => total + point.value, 0) / returns.length
    const sampleDeviation = Math.sqrt(
      returns.reduce((total, point) => total + Math.pow(point.value - mean, 2), 0) /
        (returns.length - 1),
    )

    expect(computeDailySqn(returns)).toBeCloseTo(
      (Math.sqrt(returns.length) * mean) / sampleDeviation,
    )
    expect(computeDailySqn([{ time: day(0), value: 0.01 }])).toBeNaN()
    expect(
      computeDailySqn([
        { time: day(0), value: 0.01 },
        { time: day(1), value: 0.01 },
      ]),
    ).toBeNaN()
  })

  it('measures the longest peak-recovery stagnation period, including an open period', () => {
    expect(
      computeLongestStagnationDays([
        { time: day(0), value: 1 },
        { time: day(1), value: 0.9 },
        { time: day(2), value: 0.95 },
        { time: day(3), value: 1.01 },
        { time: day(4), value: 1 },
      ]),
    ).toBe(3)
  })

  it('derives recovery, current drawdown, profitable days, and track-record bounds', () => {
    const metrics = buildPortfolioSummaryMetrics(
      summary,
      [
        { time: day(1), value: 2.2 },
        { time: day(0), value: 2 },
        { time: day(2), value: 2.1 },
      ],
      [
        { time: day(0), value: Number.NaN },
        { time: day(1), value: 0.1 },
        { time: day(2), value: -0.05 },
      ],
      [
        { time: day(2), value: -4.5 },
        { time: day(0), value: 0 },
      ],
    )

    expect(metrics.currentDrawdown).toBe(-4.5)
    expect(metrics.profitableDaysPct).toBe(50)
    expect(metrics.highWaterReturnPct).toBeCloseTo(10)
    expect(metrics.recoveryFactor).toBe(4)
    expect(metrics.tradingDays).toBe(3)
    expect(metrics.startTime).toBe(day(0))
    expect(metrics.endTime).toBe(day(2))
  })

  it('keeps unknown status values separate from healthy sleeves', () => {
    const rows = ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].map(
      (status, index) => ({ id: index, status }) as RiskRow,
    )

    expect(buildPortfolioStatusCounts(rows)).toEqual({
      green: 1,
      yellow: 1,
      red: 1,
      unknown: 1,
      total: 4,
    })
  })
})
