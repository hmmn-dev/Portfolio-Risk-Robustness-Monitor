import { parseDeals } from '../engine/parseDeals'
import { buildPortfolioReport } from '../engine/portfolioSeries'
import { parseUnderlying } from '../engine/underlying'
import type { DealRow, ReportModel, UnderlyingSeries } from '../engine/types'

export type EngineRequest =
  | {
      id: string
      type: 'parseDeals'
      text: string
      sourceName?: string
    }
  | {
      id: string
      type: 'parseUnderlying'
      text: string
      sourceName?: string
    }
  | {
      id: string
      type: 'buildReport'
      deals: DealRow[]
      underlying?: UnderlyingSeries[]
    }

export type EngineResponse =
  | {
      id: string
      type: 'parseDealsResult'
      rows: DealRow[]
    }
  | {
      id: string
      type: 'parseUnderlyingResult'
      rows: UnderlyingSeries
    }
  | {
      id: string
      type: 'reportResult'
      report: ReportModel
    }
  | {
      id: string
      type: 'error'
      message: string
    }

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { data } = event
  try {
    if (data.type === 'parseDeals') {
      const rows = parseDeals(data.text, { sourceName: data.sourceName })
      self.postMessage({ id: data.id, type: 'parseDealsResult', rows } satisfies EngineResponse)
      return
    }
    if (data.type === 'parseUnderlying') {
      const rows = parseUnderlying(data.text, { sourceName: data.sourceName })
      self.postMessage({ id: data.id, type: 'parseUnderlyingResult', rows } satisfies EngineResponse)
      return
    }
    if (data.type === 'buildReport') {
      const underlyingTimeframes = (data.underlying ?? []).reduce(
        (acc, series) => {
          acc[series.symbol] = series.timeframe
          return acc
        },
        {} as Record<string, UnderlyingSeries['timeframe']>
      )
      const report: ReportModel = buildPortfolioReport(data.deals, {
        generatedAt: Date.now(),
        underlyingTimeframes,
        underlyingSeries: data.underlying ?? [],
      })

      self.postMessage({ id: data.id, type: 'reportResult', report } satisfies EngineResponse)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error'
    self.postMessage({ id: data.id, type: 'error', message } satisfies EngineResponse)
  }
}
