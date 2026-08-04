// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import type { DealRow, UnderlyingSeries } from '../../../engine/types'
import { ALL_CHART_RANGE } from '../helpers/chartRange'
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

const makePositionDeals = (
  sleeve: string,
  positionId: number,
  volume: number,
  sequence: number,
): DealRow[] => [
  {
    deal: `${sleeve}-open`,
    time: day(0),
    sleeve,
    symbol: 'EURUSD',
    notional: 0,
    price: 100,
    side: 'buy',
    volume,
    entryType: 'in',
    positionId,
    _seq: sequence,
  },
  {
    deal: `${sleeve}-close`,
    time: day(2),
    sleeve,
    symbol: 'EURUSD',
    notional: -10 * volume,
    price: 90,
    volume,
    entryType: 'out',
    profit: -10 * volume,
    positionId,
    _seq: sequence + 1,
  },
]

describe('usePortfolioAnalytics', () => {
  it('uses selected-sleeve MTM drawdown instead of the baseline portfolio series', () => {
    const deals = [
      ...makePositionDeals('Alpha - EURUSD', 1, 1, 0),
      ...makePositionDeals('Beta - EURUSD', 2, 4, 2),
    ]
    const underlyingSeries: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'D1',
        candles: [
          { time: day(0), open: 100, high: 100, low: 100, close: 100 },
          { time: day(1), open: 90, high: 90, low: 90, close: 90 },
          { time: day(2), open: 90, high: 90, low: 90, close: 90 },
        ],
        daily: [],
      },
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 1000, underlyingSeries })
    expect(report.portfolio.drawdownMtm?.[1].value).toBeCloseTo(-5)

    const { result } = renderHook(() =>
      usePortfolioAnalytics({
        report,
        deals,
        baseCapital: 1000,
        drawdownMode: 'mtm',
        portfolioDrawdown: report.portfolio.drawdownMtm ?? [],
        portfolioDrawdownFallback: [],
        portfolioDrawdownSource: report.portfolio.drawdownMtmSource,
        portfolioSummary: {
          totalReturnPct: -5,
          cagr: -5,
          maxDrawdown: -5,
          mar: -1,
          sharpe: -1,
          regression: null,
        },
        correlationMatrix: { labels: [], values: [] },
        underlyingSeries,
        enabledSleeves: new Set(['Alpha - EURUSD']),
        sleeveWeights: { 'Alpha - EURUSD': 1, 'Beta - EURUSD': 1 },
        isFiltered: true,
        hasCustomWeights: false,
        rangeSelection: ALL_CHART_RANGE,
      }),
    )

    expect(result.current.effectiveDrawdownMode).toBe('mtm')
    expect(result.current.effectiveDrawdownSource).toBe('D1')
    expect(result.current.chartDrawdown[1].value).toBeCloseTo(-1)
    expect(result.current.effectiveSummary?.maxDrawdown).toBeCloseTo(-1)

    const { result: weightedResult } = renderHook(() =>
      usePortfolioAnalytics({
        report,
        deals,
        baseCapital: 1000,
        drawdownMode: 'mtm',
        portfolioDrawdown: report.portfolio.drawdownMtm ?? [],
        portfolioDrawdownFallback: [],
        portfolioDrawdownSource: report.portfolio.drawdownMtmSource,
        portfolioSummary: {
          totalReturnPct: -5,
          cagr: -5,
          maxDrawdown: -5,
          mar: -1,
          sharpe: -1,
          regression: null,
        },
        correlationMatrix: { labels: [], values: [] },
        underlyingSeries,
        enabledSleeves: new Set(['Alpha - EURUSD', 'Beta - EURUSD']),
        sleeveWeights: { 'Alpha - EURUSD': 2, 'Beta - EURUSD': 0.5 },
        isFiltered: false,
        hasCustomWeights: true,
        rangeSelection: ALL_CHART_RANGE,
      }),
    )

    expect(weightedResult.current.chartDrawdown[1].value).toBeCloseTo(-4)
    expect(weightedResult.current.effectiveIndex.at(-1)?.value).toBeCloseTo(0.96)
    expect(weightedResult.current.effectiveSummary?.maxDrawdown).toBeCloseTo(-4)
  })

  it('uses realized drawdown after custom MTM candle coverage ends', () => {
    const deals = makePositionDeals('Alpha - EURUSD', 1, 1, 0)
    const underlyingSeries: UnderlyingSeries[] = [
      {
        symbol: 'EURUSD',
        timeframe: 'D1',
        candles: [
          { time: day(0), open: 100, high: 100, low: 100, close: 100 },
          { time: day(1), open: 90, high: 90, low: 90, close: 90 },
        ],
        daily: [],
      },
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 1000, underlyingSeries })

    const { result } = renderHook(() =>
      usePortfolioAnalytics({
        report,
        deals,
        baseCapital: 1000,
        drawdownMode: 'mtm',
        portfolioDrawdown: report.portfolio.drawdown,
        portfolioDrawdownFallback: [],
        portfolioDrawdownSource: report.portfolio.drawdownMtmSource,
        portfolioSummary: null,
        correlationMatrix: { labels: [], values: [] },
        underlyingSeries,
        enabledSleeves: new Set(['Alpha - EURUSD']),
        sleeveWeights: { 'Alpha - EURUSD': 2 },
        isFiltered: false,
        hasCustomWeights: true,
        rangeSelection: ALL_CHART_RANGE,
      }),
    )

    expect(result.current.effectiveDrawdownMode).toBe('mtm')
    expect(result.current.chartDrawdown.map((point) => point.time)).toEqual([
      day(0),
      day(1),
      day(2),
    ])
    expect(result.current.chartDrawdownFallback).toEqual([
      { time: day(2), value: expect.closeTo(-2) },
    ])
  })
})
