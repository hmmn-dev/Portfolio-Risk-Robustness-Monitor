// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import type { DealRow, UnderlyingSeries } from '../../../engine/types'
import {
  buildPortfolioSummary,
  resolvePortfolioDrawdown,
  resolvePortfolioDrawdownSource,
} from '../reportAnalytics'
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
  it('keeps factor relationships on displayed equity returns, weights and selected dates', () => {
    const marketReturns = [0.01, -0.02, 0.03, -0.01]
    let equity = 1000
    const deals = marketReturns.map((value, index): DealRow => {
      equity *= 1 + value
      return {
        deal: String(index),
        time: day(index),
        sleeve: 'Core',
        symbol: 'EURUSD',
        equity,
        balance: 1000,
        notional: 0,
        _seq: index,
      }
    })
    const report = buildPortfolioReport(deals, { initialCapital: 1000 })
    const { result, rerender } = renderHook(
      ({ multiplier, ranged }) =>
        usePortfolioAnalytics({
          report,
          deals,
          baseCapital: 1000,
          drawdownMode: 'mtm',
          portfolioDrawdown: report.portfolio.drawdownMtm ?? [],
          portfolioDrawdownFallback: [],
          portfolioSummary: null,
          correlationMatrix: { labels: [], values: [] },
          underlyingSeries: [
            {
              symbol: 'EURUSD',
              timeframe: 'D1',
              candles: [],
              daily: marketReturns.map((value, index) => ({
                symbol: 'EURUSD',
                time: day(index),
                close: 100,
                return: value,
              })),
            },
          ],
          enabledSleeves: new Set(['Core']),
          sleeveWeights: { Core: multiplier },
          isFiltered: false,
          hasCustomWeights: multiplier !== 1,
          rangeSelection: ranged
            ? { type: 'custom', startTime: day(1), endTime: day(2) }
            : ALL_CHART_RANGE,
        }),
      { initialProps: { multiplier: 1, ranged: false } },
    )
    expect(result.current.factorRelationships.portfolio.daily[0].beta).toBeCloseTo(1)
    expect(result.current.factorRelationships.portfolio.daily[0].correlation).toBeCloseTo(1)
    rerender({ multiplier: 2, ranged: false })
    expect(result.current.factorRelationships.portfolio.daily[0].beta).toBeCloseTo(2)
    expect(result.current.factorRelationships.portfolio.daily[0].correlation).toBeCloseTo(1)
    rerender({ multiplier: 2, ranged: true })
    expect(result.current.factorRelationships.portfolio.daily[0].observations).toBe(2)
    expect(result.current.factorRelationships.portfolio.daily[0].beta).toBeNull()
    expect(report.portfolio.equity?.dailyReturns[0].value).toBeCloseTo(0.01)
  })

  it('uses recorded equity consistently for charts, daily metrics, ranges and baseline drawdown', () => {
    const deals: DealRow[] = [
      {
        deal: '1',
        time: day(0) + 3600000,
        sleeve: 'Core',
        notional: 0,
        balance: 1000,
        equity: 1000,
        _seq: 0,
      },
      {
        deal: '2',
        time: day(1),
        sleeve: 'Core',
        notional: 200,
        balance: 1200,
        equity: 1050,
        _seq: 1,
      },
      {
        deal: '3',
        time: day(1) + 1000,
        sleeve: 'Core',
        notional: -100,
        balance: 1100,
        equity: 1020,
        _seq: 2,
      },
      {
        deal: '4',
        time: day(2),
        sleeve: 'Core',
        notional: 0,
        balance: 1100,
        equity: 1040,
        _seq: 3,
      },
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 1000 })
    const { result, rerender } = renderHook(
      ({
        mode,
        custom,
        ranged,
      }: {
        mode: 'deal' | 'mtm'
        custom: boolean
        ranged: boolean | 'first'
      }) =>
        usePortfolioAnalytics({
          report,
          deals,
          baseCapital: 1000,
          drawdownMode: mode,
          portfolioDrawdown: resolvePortfolioDrawdown(report, mode),
          portfolioDrawdownFallback: [],
          portfolioDrawdownSource: resolvePortfolioDrawdownSource(report, mode),
          portfolioSummary: buildPortfolioSummary(
            report,
            resolvePortfolioDrawdown(report, mode),
            {},
            mode,
          ),
          correlationMatrix: { labels: [], values: [] },
          underlyingSeries: [],
          enabledSleeves: new Set(['Core']),
          sleeveWeights: { Core: custom ? 0.5 : 1 },
          isFiltered: false,
          hasCustomWeights: custom,
          rangeSelection: ranged
            ? {
                type: 'custom',
                startTime: day(ranged === 'first' ? 0 : 2),
                endTime: day(ranged === 'first' ? 0 : 2),
              }
            : ALL_CHART_RANGE,
        }),
      {
        initialProps: {
          mode: 'mtm' as 'deal' | 'mtm',
          custom: false,
          ranged: false as boolean | 'first',
        },
      },
    )
    expect(result.current.equitySource).toBe('deal-snapshots')
    expect(result.current.chartIndex.map((point) => point.value)).toEqual([1, 1.05, 1.02, 1.04])
    expect(result.current.effectiveIndex).toHaveLength(3)
    expect(result.current.effectiveReturns[2].value).toBeCloseTo(1040 / 1020 - 1)
    expect(result.current.effectiveSummary?.totalReturnPct).toBeCloseTo(4)
    expect(result.current.effectiveSummary?.maxDrawdown).toBeCloseTo((1020 / 1050 - 1) * 100)
    expect(result.current.chartDrawdownFallback).toEqual([])
    rerender({ mode: 'mtm', custom: false, ranged: true })
    expect(result.current.effectiveReturns).toHaveLength(1)
    expect(result.current.effectiveSummary?.totalReturnPct).toBeCloseTo((1040 / 1020 - 1) * 100)
    rerender({ mode: 'mtm', custom: false, ranged: 'first' })
    expect(result.current.effectiveReturns).toHaveLength(1)
    expect(result.current.effectiveReturns[0].time).toBe(day(0))
    rerender({ mode: 'deal', custom: false, ranged: false })
    expect(result.current.equitySource).toBeUndefined()
    expect(result.current.chartIndex).toEqual(report.portfolio.index)
    rerender({ mode: 'mtm', custom: true, ranged: false })
    expect(result.current.equitySource).toBe('deal-snapshots')
    expect(result.current.effectiveDrawdownMode).toBe('mtm')
    expect(result.current.mtmAvailable).toBe(true)
    expect(result.current.chartIndex.at(-1)?.value).toBeCloseTo(
      1.025 * (1 + 0.5 * (1020 / 1050 - 1)) * (1 + 0.5 * (1040 / 1020 - 1)),
    )
    expect(result.current.chartIndex).not.toEqual(report.portfolio.equity?.index)
  })

  it('applies uniform 2x risk to baseline equity returns without switching to balance replay', () => {
    const deals: DealRow[] = [990, 1050, 1020, 1040].map((equity, index) => ({
      deal: String(index),
      time: day(index),
      sleeve: index % 2 ? 'Hedge' : 'Core',
      notional: index === 1 ? 200 : 0,
      balance: index === 0 ? 1000 : 1200,
      equity,
      _seq: index,
    }))
    const report = buildPortfolioReport(deals, { initialCapital: 1000 })
    const baseline = structuredClone(report.portfolio.equity)
    if (!report.portfolio.equity) throw new Error('Expected recorded equity')
    report.portfolio.equity.recordedOnlyDrawdown = [
      report.portfolio.equity.drawdown[0],
      report.portfolio.equity.drawdown[3],
    ]
    const { result } = renderHook(() =>
      usePortfolioAnalytics({
        report,
        deals,
        baseCapital: 1000,
        drawdownMode: 'mtm',
        portfolioDrawdown: report.portfolio.drawdownMtm ?? [],
        portfolioDrawdownFallback: [],
        portfolioDrawdownSource: report.portfolio.drawdownMtmSource,
        portfolioSummary: null,
        correlationMatrix: { labels: [], values: [] },
        underlyingSeries: [],
        enabledSleeves: new Set(['Core', 'Hedge']),
        sleeveWeights: { Core: 2, Hedge: 2 },
        isFiltered: false,
        hasCustomWeights: true,
        rangeSelection: ALL_CHART_RANGE,
      }),
    )
    const expected = [0.98]
    for (let index = 1; index < deals.length; index++) {
      expected.push(
        expected[index - 1] * (1 + 2 * (deals[index].equity! / deals[index - 1].equity! - 1)),
      )
    }
    expect(result.current.effectiveDrawdownMode).toBe('mtm')
    expect(result.current.equityExposureMultiplier).toBe(2)
    expect(result.current.chartIndex.map((point) => point.value)).toEqual(
      expected.map((value) => expect.closeTo(value)),
    )
    expect(result.current.chartDrawdown[0].value).toBeCloseTo(-2)
    expect(result.current.effectiveSummary?.maxDrawdown).toBeCloseTo((1020 / 1050 - 1) * 200)
    expect(result.current.effectiveReturns[2].value).toBeCloseTo(2 * (1020 / 1050 - 1))
    expect(result.current.chartDrawdownFallback).toEqual([
      result.current.chartDrawdown[0],
      result.current.chartDrawdown[3],
    ])
    expect(report.portfolio.equity.index).toEqual(baseline?.index)
  })

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
    expect(result.current.equitySource).toBe('D1')
    expect(result.current.chartIndex[1].value).toBeCloseTo(0.99)
    expect(result.current.effectiveSummary?.maxDrawdown).toBeCloseTo(-1)
    expect(result.current.tradeStats).toEqual({
      tradeCount: 1,
      directionalTradeCount: 1,
      longExposurePct: 100,
    })

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
    expect(weightedResult.current.chartIndex[1].value).toBeCloseTo(0.96)
    expect(weightedResult.current.effectiveIndex.at(-1)?.value).toBeCloseTo(0.96)
    expect(weightedResult.current.effectiveSummary?.maxDrawdown).toBeCloseTo(-4)
    expect(weightedResult.current.tradeStats).toEqual({
      tradeCount: 2,
      directionalTradeCount: 2,
      longExposurePct: 100,
    })
  })

  it('keeps custom equity for sleeve selection and multipliers through partial candle coverage', () => {
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
        ],
        daily: [],
      },
    ]
    const report = buildPortfolioReport(deals, { initialCapital: 1000, underlyingSeries })

    const { result, rerender } = renderHook(
      ({ drawdownMode, weight }: { drawdownMode: 'deal' | 'mtm'; weight: number }) =>
        usePortfolioAnalytics({
          report,
          deals,
          baseCapital: 1000,
          drawdownMode,
          portfolioDrawdown: report.portfolio.drawdown,
          portfolioDrawdownFallback: [],
          portfolioDrawdownSource: report.portfolio.drawdownMtmSource,
          portfolioSummary: null,
          correlationMatrix: { labels: [], values: [] },
          underlyingSeries,
          enabledSleeves: new Set(['Alpha - EURUSD']),
          sleeveWeights: { 'Alpha - EURUSD': weight },
          isFiltered: true,
          hasCustomWeights: weight !== 1,
          rangeSelection: ALL_CHART_RANGE,
        }),
      { initialProps: { drawdownMode: 'mtm' as 'deal' | 'mtm', weight: 2 } },
    )

    expect(result.current.effectiveDrawdownMode).toBe('mtm')
    expect(result.current.equitySource).toBe('D1')
    expect(result.current.chartIndex.map((point) => point.value)).toEqual([1, 0.98, 0.98])
    expect(result.current.effectiveSummary?.maxDrawdown).toBeCloseTo(-2)
    expect(result.current.effectiveSummary?.totalReturnPct).toBeCloseTo(-2)
    expect(report.portfolio.index.at(-1)?.value).toBeCloseTo(0.95)
    expect(result.current.chartDrawdown.map((point) => point.time)).toEqual([
      day(0),
      day(1),
      day(2),
    ])
    expect(result.current.chartDrawdownFallback).toEqual([
      { time: day(2), value: expect.closeTo(-2) },
    ])

    rerender({ drawdownMode: 'mtm', weight: 1 })
    expect(result.current.equitySource).toBe('D1')
    expect(result.current.chartIndex[1].value).toBeCloseTo(0.99)

    rerender({ drawdownMode: 'deal', weight: 2 })

    expect(result.current.effectiveDrawdownMode).toBe('deal')
    expect(result.current.chartDrawdownFallback).toEqual([])
    expect(result.current.chartDrawdown.at(-1)?.value).toBeCloseTo(-2)
  })

  it('includes trades opened later on the final displayed day', () => {
    const deals = makePositionDeals('Alpha - EURUSD', 1, 1, 0).map((deal, index) => ({
      ...deal,
      time: day(2) + (12 + index) * 60 * 60 * 1000,
    }))
    const report = buildPortfolioReport(deals, { initialCapital: 1000 })

    const { result } = renderHook(() =>
      usePortfolioAnalytics({
        report,
        deals,
        baseCapital: 1000,
        drawdownMode: 'deal',
        portfolioDrawdown: report.portfolio.drawdown,
        portfolioDrawdownFallback: [],
        portfolioDrawdownSource: report.portfolio.drawdownSource,
        portfolioSummary: null,
        correlationMatrix: { labels: [], values: [] },
        underlyingSeries: [],
        enabledSleeves: new Set(['Alpha - EURUSD']),
        sleeveWeights: { 'Alpha - EURUSD': 1 },
        isFiltered: false,
        hasCustomWeights: false,
        rangeSelection: ALL_CHART_RANGE,
      }),
    )

    expect(result.current.tradeStats?.tradeCount).toBe(1)
  })
})
