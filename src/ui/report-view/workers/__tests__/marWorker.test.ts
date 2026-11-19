// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolioReport } from '../../../../engine/portfolioSeries'
import { resolvePortfolioDrawdown } from '../../../../engine/portfolioDrawdown'
import { buildPortfolioSummary } from '../../reportAnalytics'
import type { DealRow, ReportModel } from '../../../../engine/types'

afterEach(() => vi.unstubAllGlobals())

describe('MAR worker account equity', () => {
  it('applies simulated costs to equity snapshots as well as balance without changing source deals', async () => {
    const postMessage =
      vi.fn<(response: { report: ReportModel; appliedPct: number | null }) => void>()
    const worker: {
      onmessage: ((event: MessageEvent) => void) | null
      postMessage: typeof postMessage
    } = {
      onmessage: null,
      postMessage,
    }
    vi.stubGlobal('self', worker)
    await import('../marWorker')
    const deals: DealRow[] = [
      {
        deal: '1',
        time: Date.UTC(2024, 0, 1),
        sleeve: 'Core',
        notional: 0,
        balance: 1000,
        equity: 1000,
        _seq: 0,
      },
      {
        deal: '2',
        time: Date.UTC(2024, 0, 2),
        sleeve: 'Core',
        notional: 200,
        balance: 1200,
        equity: 1100,
        _seq: 1,
      },
      {
        deal: '3',
        time: Date.UTC(2025, 0, 2),
        sleeve: 'Core',
        notional: -50,
        balance: 1150,
        equity: 1080,
        _seq: 2,
      },
    ]
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          requestId: 1,
          deals,
          underlyingSeries: [],
          underlyingTimeframes: {},
          drawdownMode: 'mtm',
          targetPct: 50,
        },
      }),
    )
    expect(postMessage).toHaveBeenCalledOnce()
    const result = postMessage.mock.calls[0][0]
    expect(result.appliedPct).toBe(50)
    expect(result.report.portfolio.equity?.source).toBe('deal-snapshots')
    const balanceCost = 1150 - (result.report.portfolio.days.at(-1)?.equity ?? NaN)
    const equityCost = 1080 - (result.report.portfolio.equity?.index.at(-1)?.value ?? NaN) * 1000
    expect(balanceCost).toBeGreaterThan(0)
    expect(equityCost).toBeCloseTo(balanceCost)
    expect(deals[2].equity).toBe(1080)
    expect(deals[2].balance).toBe(1150)
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          requestId: 2,
          deals,
          underlyingSeries: [],
          underlyingTimeframes: {},
          drawdownMode: 'mtm',
          targetPct: 50,
        },
      }),
    )
    const base = buildPortfolioReport(deals)
    const baselineMar = buildPortfolioSummary(
      base,
      resolvePortfolioDrawdown(base, 'mtm'),
      {},
      'mtm',
    ).mar
    const adjusted = postMessage.mock.calls[1][0].report
    const adjustedMar = buildPortfolioSummary(
      adjusted,
      resolvePortfolioDrawdown(adjusted, 'mtm'),
      {},
      'mtm',
    ).mar
    expect(adjustedMar).toBeCloseTo(baselineMar * 0.5, 3)

    const opening = Date.UTC(2024, 0, 1)
    const candleDeals: DealRow[] = [
      {
        ...deals[0],
        symbol: 'EURUSD',
        entryType: 'in',
        side: 'buy',
        price: 100,
        volume: 1,
        positionId: 1,
      },
      { ...deals[1], symbol: 'EURUSD', balance: 1000, equity: 1100, notional: 0 },
      {
        ...deals[2],
        symbol: 'EURUSD',
        entryType: 'out',
        price: 120,
        volume: 1,
        positionId: 1,
        profit: 200,
        notional: 200,
        balance: 1200,
        equity: 1200,
      },
    ]
    const underlyingSeries = [
      {
        symbol: 'EURUSD',
        timeframe: 'H1' as const,
        daily: [],
        candles: [{ time: opening + 3600000, open: 100, high: 100, low: 98, close: 98 }],
      },
    ]
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          requestId: 3,
          deals: candleDeals,
          underlyingSeries,
          underlyingTimeframes: { EURUSD: 'H1' },
          drawdownMode: 'mtm',
          targetPct: 50,
        },
      }),
    )
    const reconstructed = postMessage.mock.calls[2][0].report
    expect(reconstructed.portfolio.equity?.source).toBe('recorded+H1')
    expect(
      reconstructed.portfolio.equity?.index.find(
        (point) => point.time === opening + 2 * 3600000 - 1,
      )?.value,
    ).toBeCloseTo(0.98)
    const candleBase = buildPortfolioReport(candleDeals, { underlyingSeries })
    const candleBaseMar = buildPortfolioSummary(
      candleBase,
      resolvePortfolioDrawdown(candleBase, 'mtm'),
      {},
      'mtm',
    ).mar
    const reconstructedMar = buildPortfolioSummary(
      reconstructed,
      resolvePortfolioDrawdown(reconstructed, 'mtm'),
      {},
      'mtm',
    ).mar
    expect(reconstructedMar).toBeCloseTo(candleBaseMar * 0.5, 3)
  })
})
