import { resolveMtmDrawdownCoverage } from './drawdownCoverage'
import type { ReportModel } from './types'

export const resolvePortfolioDrawdownSeries = (
  report: ReportModel | null,
  mode: 'deal' | 'mtm',
) => {
  const realized = report?.portfolio.drawdown ?? []
  if (mode === 'deal') return { drawdown: realized, realizedFallback: [] }
  const equity = report?.portfolio.equity
  if (equity)
    return { drawdown: equity.drawdown, realizedFallback: equity.recordedOnlyDrawdown ?? [] }
  if (!report?.portfolio.drawdownMtm?.length) return { drawdown: realized, realizedFallback: [] }
  return resolveMtmDrawdownCoverage(realized, report?.portfolio.drawdownMtm ?? [])
}
export const resolvePortfolioDrawdown = (report: ReportModel | null, mode: 'deal' | 'mtm') =>
  resolvePortfolioDrawdownSeries(report, mode).drawdown
export const resolvePortfolioDrawdownFallback = (
  report: ReportModel | null,
  mode: 'deal' | 'mtm',
) => resolvePortfolioDrawdownSeries(report, mode).realizedFallback
export const resolvePortfolioDrawdownSource = (report: ReportModel | null, mode: 'deal' | 'mtm') =>
  mode === 'mtm'
    ? (report?.portfolio.equity?.source ??
      report?.portfolio.drawdownMtmSource ??
      report?.portfolio.drawdownSource)
    : report?.portfolio.drawdownSource
