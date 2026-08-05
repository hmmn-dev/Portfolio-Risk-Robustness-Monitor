import { computeDdShock } from '../../engine/ddShock'
import { resolveMtmDrawdownCoverage } from '../../engine/drawdownCoverage'
import {
  getPairCoverage,
  rollingOlsPairs,
  rollingSharpe,
  rollingWinrate,
} from '../../engine/statsRolling'
import {
  DECAY_STATUS_POLICY,
  computeStatus,
  type StatusReason,
  type StatusResult,
} from '../../engine/status'
import type { ReportModel, UnderlyingDailyReturn, UnderlyingSeries } from '../../engine/types'
import type { SleeveMetrics } from './components/SleeveSection'
import {
  buildObfuscationMap,
  buildSleeveKey,
  normalizeSymbol,
  splitSleeveLabel,
} from './helpers/labels'
import { computeSeriesBounds } from './helpers/chartSeries'
import { portfolioRegression } from './helpers/regression'
import {
  alignPairsByDay,
  buildReturnMap,
  computeMean,
  computeSharpe,
  getCurrentFinite,
  getSeriesValues,
  sanitizeSeries,
  sumFinite,
} from './helpers/series'
import { buildContributionCorrelationMatrix } from './portfolio/portfolioCalculations'
import type { CorrelationMatrix, PerformanceRow, PortfolioSummary, RiskRow } from './types'

export const METRIC_WINDOW = {
  short: 252,
  long: 504,
} as const

export type DrawdownMode = 'deal' | 'mtm'

export type NormalizedUnderlying = Record<string, UnderlyingDailyReturn[]>

export type ReportObfuscation = {
  formatSleeve: (value: string, symbol: string) => string
  formatSymbol: (value: string) => string
  formatSleeveLabel: (value: string) => string
}

export const normalizeUnderlyingBySymbol = (
  underlyingBySymbol: Record<string, UnderlyingSeries>,
): NormalizedUnderlying => {
  const normalized: NormalizedUnderlying = {}
  Object.entries(underlyingBySymbol).forEach(([key, value]) => {
    const symbol = normalizeSymbol(key)
    if (!normalized[symbol]) {
      normalized[symbol] = value.daily
    }
  })
  return normalized
}

export const buildUnderlyingTimeframes = (
  underlyingBySymbol: Record<string, UnderlyingSeries>,
): Record<string, 'H1' | 'D1'> =>
  Object.fromEntries(
    Object.entries(underlyingBySymbol).map(([symbol, series]) => [symbol, series.timeframe]),
  )

export const findUnderlyingForSymbol = (
  normalizedUnderlying: NormalizedUnderlying,
  symbol: string,
  sleeveLabel: string,
) => {
  const base = symbol || splitSleeveLabel(sleeveLabel).symbol
  return base ? (normalizedUnderlying[normalizeSymbol(base)] ?? null) : null
}

export const resolvePortfolioDrawdownSeries = (report: ReportModel | null, mode: DrawdownMode) => {
  const realized = report?.portfolio.drawdown ?? []
  return mode === 'mtm' && report?.portfolio.drawdownMtm?.length
    ? resolveMtmDrawdownCoverage(realized, report.portfolio.drawdownMtm)
    : { drawdown: realized, realizedFallback: [] }
}

export const resolvePortfolioDrawdown = (report: ReportModel | null, mode: DrawdownMode) =>
  resolvePortfolioDrawdownSeries(report, mode).drawdown

export const resolvePortfolioDrawdownFallback = (report: ReportModel | null, mode: DrawdownMode) =>
  resolvePortfolioDrawdownSeries(report, mode).realizedFallback

export const resolvePortfolioDrawdownSource = (report: ReportModel | null, mode: DrawdownMode) =>
  mode === 'mtm' && report?.portfolio.drawdownMtmSource
    ? report.portfolio.drawdownMtmSource
    : report?.portfolio.drawdownSource

export const resolveSleeveDrawdown = (
  item: ReportModel['contributions'][number] | null,
  mode: DrawdownMode,
) => {
  if (!item) return []
  return mode === 'mtm' && item.drawdownMtm?.length ? item.drawdownMtm : (item.drawdown ?? [])
}

export const resolveSleeveDrawdownSource = (
  item: ReportModel['contributions'][number] | null,
  mode: DrawdownMode,
) => {
  if (!item) return undefined
  return mode === 'mtm' && item.drawdownMtmSource ? item.drawdownMtmSource : item.drawdownSource
}

export const computeSleeveMetrics = (
  item: ReportModel['contributions'][number],
  portfolioReturnMap: Map<number, number>,
  window: number,
  underlying: UnderlyingDailyReturn[] | null,
): SleeveMetrics => {
  const returns = sanitizeSeries(getSeriesValues(item.returns))
  const minObs = Math.floor(window * DECAY_STATUS_POLICY.minAlignedRatio)
  const minActive = DECAY_STATUS_POLICY.minActiveObservations
  const hasUnderlying = !!underlying && underlying.length > 0
  const returnsMap = hasUnderlying ? buildReturnMap(underlying) : null
  const alignedPrimary = alignPairsByDay(item.returns, returnsMap ?? portfolioReturnMap)
  const alignedFallback = alignPairsByDay(item.returns, portfolioReturnMap)
  const primaryCoverage = getPairCoverage(alignedPrimary.xs, alignedPrimary.ys, window)
  const useFallback = !hasUnderlying || (returnsMap && primaryCoverage.alignedObservations < minObs)
  const aligned = useFallback ? alignedFallback : alignedPrimary
  const alphaValues = rollingOlsPairs(aligned.xs, aligned.ys, window, {
    minObs,
    minActive,
  }).alpha
  const alphaSeries = alphaValues.map((value, index) => ({
    time: aligned.times[index] ?? index,
    value: Number.isFinite(value) ? value * 252 * 100 : value,
  }))
  const sharpeSeries = rollingSharpe(returns, window).map((value, index) => ({
    time: item.returns[index]?.time ?? index,
    value,
  }))
  const winrateSeries = rollingWinrate(returns, window).map((value, index) => ({
    time: item.returns[index]?.time ?? index,
    value: Math.min(1, Math.max(0, value)),
  }))

  return {
    alphaSeries,
    alphaBounds: computeSeriesBounds(
      alphaSeries.map((point) => point.value),
      0.15,
      0.01,
    ),
    sharpeSeries,
    sharpeBounds: computeSeriesBounds(
      sharpeSeries.map((point) => point.value),
      0.2,
      0.05,
    ),
    winrateSeries,
  }
}

export const buildPortfolioSummary = (
  report: ReportModel,
  portfolioDrawdown: ReportModel['portfolio']['drawdown'],
  normalizedUnderlying: NormalizedUnderlying,
): PortfolioSummary => {
  const returns = report.portfolio.days.map((day) => day.return)
  const firstIndexPoint = report.portfolio.index[0]
  const lastIndexPoint = report.portfolio.index.at(-1)
  const totalReturnPct = lastIndexPoint ? (lastIndexPoint.value - 1) * 100 : Number.NaN
  const years =
    firstIndexPoint && lastIndexPoint
      ? (lastIndexPoint.time - firstIndexPoint.time) / (365.25 * 24 * 60 * 60 * 1000)
      : Number.NaN
  const cagr =
    firstIndexPoint &&
    lastIndexPoint &&
    firstIndexPoint.value > 0 &&
    lastIndexPoint.value > 0 &&
    Number.isFinite(years) &&
    years > 0
      ? (Math.pow(lastIndexPoint.value / firstIndexPoint.value, 1 / years) - 1) * 100
      : Number.NaN
  const maxDrawdown = portfolioDrawdown.reduce(
    (minimum, point) => (point.value < minimum ? point.value : minimum),
    0,
  )
  const symbols = Array.from(
    new Set(
      report.contributions
        .map((item) => normalizeSymbol(item.symbol))
        .filter((value) => value.length > 0),
    ),
  )

  return {
    totalReturnPct,
    cagr,
    maxDrawdown,
    mar: maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : Number.NaN,
    sharpe: computeSharpe(returns),
    regression: portfolioRegression(report.portfolio.days, symbols, normalizedUnderlying),
  }
}

export const buildPerformanceRows = (report: ReportModel): PerformanceRow[] =>
  report.contributions.map((item, index) => {
    const pnl = getSeriesValues(item.pnl)
    const returns = getSeriesValues(item.returns)
    const last2yReturns = returns.slice(-METRIC_WINDOW.long)
    const sleeveParts = splitSleeveLabel(item.sleeve)

    return {
      id: index,
      sleeve: sleeveParts.sleeve,
      symbol: sleeveParts.symbol || item.symbol,
      totalPnl: sumFinite(pnl),
      meanAnn: computeMean(returns) * 252 * 100,
      sharpe: computeSharpe(returns),
      last2yPnl: sumFinite(pnl.slice(-METRIC_WINDOW.long)),
      last2yMeanAnn: computeMean(last2yReturns) * 252 * 100,
      last2ySharpe: computeSharpe(last2yReturns),
    }
  })

const formatEvidenceDate = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return 'never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'never' : date.toISOString().slice(0, 10)
}

const formatStatusReason = (reason: StatusReason, status: StatusResult) => {
  switch (reason) {
    case 'DD_SHOCK_RED':
      return 'DD shock RED'
    case 'OVERALL_SHARPE_NEGATIVE':
      return 'overall Sharpe < 0'
    case 'DD_SHOCK_ORANGE':
      return 'DD shock ORANGE'
    case 'ONE_YEAR_SHARPE_NEGATIVE':
      return '1Y Sharpe < 0'
    case 'TWO_YEAR_SHARPE_WEAK':
      return `2Y Sharpe <= ${DECAY_STATUS_POLICY.last2YSharpeFloor}`
    case 'ALPHA_WEAK_PERSISTENT':
      return `alpha pctile < ${DECAY_STATUS_POLICY.alphaWarningPercentile} in ${status.alphaWeakObservations}/${status.alphaRecentObservationCount} recent observations`
    case 'ALPHA_INSUFFICIENT': {
      const evidence = status.alphaEvidence
      if (evidence.alignedObservations < evidence.requiredAlignedObservations) {
        return `alpha unavailable: ${evidence.alignedObservations}/${evidence.requiredAlignedObservations} aligned observations`
      }
      if (evidence.activeObservations < evidence.requiredActiveObservations) {
        return `alpha unavailable: ${evidence.activeObservations}/${evidence.requiredActiveObservations} active observations`
      }
      if (evidence.historyObservations < evidence.requiredHistoryObservations) {
        return `alpha percentile unavailable: ${evidence.historyObservations}/${evidence.requiredHistoryObservations} historical estimates`
      }
      if (evidence.lastValidTime !== evidence.reportTime) {
        return `alpha is stale; last valid ${formatEvidenceDate(evidence.lastValidTime)}`
      }
      if (status.alphaRecentObservationCount < DECAY_STATUS_POLICY.alphaWarningLookback) {
        return `alpha not yet current for ${DECAY_STATUS_POLICY.alphaWarningLookback} consecutive observations`
      }
      return 'alpha unavailable for the current observation'
    }
    case 'ONE_YEAR_SHARPE_INSUFFICIENT':
      return '1Y Sharpe unavailable'
    case 'TWO_YEAR_SHARPE_INSUFFICIENT':
      return '2Y Sharpe unavailable'
    case 'OVERALL_SHARPE_INSUFFICIENT':
      return 'overall Sharpe unavailable'
    case 'NO_CONFIRMED_DECAY':
      return 'no confirmed decay and 2Y Sharpe > 0.5'
  }
}

const buildStatusCopy = (status: StatusResult) => ({
  reasons: `Reason: ${status.reasons
    .map((reason) => formatStatusReason(reason, status))
    .join('; ')}.`,
  action:
    status.status === 'RED'
      ? 'Reduce weight 50–100%, recheck in 3 months.'
      : status.status === 'YELLOW'
        ? 'Keep weight, review the warning in 4–6 weeks.'
        : status.status === 'UNKNOWN'
          ? 'Collect more observations; do not infer health or decay yet.'
          : 'No change.',
})

const findLastValidTime = (values: number[], times: number[]) => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return times[index] ?? null
  }
  return null
}

export const buildRiskRows = (
  report: ReportModel,
  drawdownMode: DrawdownMode,
  normalizedUnderlying: NormalizedUnderlying,
  portfolioReturnMap: Map<number, number>,
): RiskRow[] =>
  report.contributions.map((item, index) => {
    const returns = sanitizeSeries(getSeriesValues(item.returns))
    const minObs = Math.floor(METRIC_WINDOW.long * DECAY_STATUS_POLICY.minAlignedRatio)
    const minActive = DECAY_STATUS_POLICY.minActiveObservations
    const underlying = findUnderlyingForSymbol(normalizedUnderlying, item.symbol, item.sleeve)
    const hasUnderlying = !!underlying && underlying.length > 0
    const primaryReturnMap = hasUnderlying ? buildReturnMap(underlying) : portfolioReturnMap
    const alignedPrimary = alignPairsByDay(item.returns, primaryReturnMap)
    const primaryCoverage = getPairCoverage(
      alignedPrimary.xs,
      alignedPrimary.ys,
      METRIC_WINDOW.long,
    )
    const usePortfolioFallback = !hasUnderlying || primaryCoverage.alignedObservations < minObs
    const aligned = usePortfolioFallback
      ? alignPairsByDay(item.returns, portfolioReturnMap)
      : alignedPrimary
    const coverage = getPairCoverage(aligned.xs, aligned.ys, METRIC_WINDOW.long)
    const alphaSeries = rollingOlsPairs(aligned.xs, aligned.ys, METRIC_WINDOW.long, {
      minObs,
      minActive,
    }).alpha
    const reportTime = aligned.times[aligned.times.length - 1] ?? null
    const lastValidTime = findLastValidTime(alphaSeries, aligned.times)
    const last1YSharpe = getCurrentFinite(rollingSharpe(returns, METRIC_WINDOW.short))
    const last2YSharpe = getCurrentFinite(rollingSharpe(returns, METRIC_WINDOW.long))
    const overallSharpe = computeSharpe(returns)
    const winrateSeries = rollingWinrate(returns, METRIC_WINDOW.long)
    const last2YWinrate = getCurrentFinite(winrateSeries)
    const shock = computeDdShock(resolveSleeveDrawdown(item, drawdownMode)).flag

    const status = computeStatus({
      alphaSeries,
      alphaEvidence: {
        source: usePortfolioFallback ? 'PORTFOLIO' : 'UNDERLYING',
        alignedObservations: coverage.alignedObservations,
        requiredAlignedObservations: minObs,
        activeObservations: coverage.activeObservations,
        requiredActiveObservations: minActive,
        reportTime,
        lastValidTime,
      },
      winrateSeries,
      last1YSharpe: Number.isFinite(last1YSharpe) ? last1YSharpe : null,
      last2YSharpe: Number.isFinite(last2YSharpe) ? last2YSharpe : null,
      overallSharpe: Number.isFinite(overallSharpe) ? overallSharpe : null,
      last2YWinrate: Number.isFinite(last2YWinrate) ? last2YWinrate : null,
      shock,
    })
    const statusCopy = buildStatusCopy(status)
    const sleeveParts = splitSleeveLabel(item.sleeve)

    return {
      id: index,
      sleeve: sleeveParts.sleeve,
      symbol: sleeveParts.symbol || item.symbol,
      status: status.status,
      shock: status.shock,
      alphaPct: status.alphaPercentile,
      alphaEvidence: status.alphaEvidence,
      alphaWeakObservations: status.alphaWeakObservations,
      alphaRecentObservationCount: status.alphaRecentObservationCount,
      winratePctile: status.winratePercentile,
      last1ySharpe: status.last1YSharpe,
      last2ySharpe: status.last2YSharpe,
      overallSharpe: status.overallSharpe,
      last2yWinrate: status.last2YWinrate,
      statusReasonCodes: status.reasons,
      statusReasons: statusCopy.reasons,
      statusAction: statusCopy.action,
    }
  })

export const buildCorrelationMatrix = (report: ReportModel): CorrelationMatrix =>
  buildContributionCorrelationMatrix(report.contributions)

export const buildReportObfuscation = (
  report: ReportModel,
  portfolioSummary: PortfolioSummary | null,
): ReportObfuscation => {
  const sleeveKeys = report.contributions.map((item) => {
    const parts = splitSleeveLabel(item.sleeve)
    return buildSleeveKey(parts.sleeve, parts.symbol || item.symbol)
  })
  const symbols = report.contributions.map((item) => {
    const parts = splitSleeveLabel(item.sleeve)
    return parts.symbol || item.symbol
  })
  portfolioSummary?.regression?.betas.forEach((item) => symbols.push(item.symbol))
  const sleeveMap = buildObfuscationMap(sleeveKeys, 'SLEEVE')
  const symbolMap = buildObfuscationMap(symbols, 'SYM')
  const formatSleeve = (value: string, symbol: string) =>
    sleeveMap.get(buildSleeveKey(value, symbol)) ?? value
  const formatSymbol = (value: string) => symbolMap.get(value) ?? value

  return {
    formatSleeve,
    formatSymbol,
    formatSleeveLabel: (label) => {
      const parts = splitSleeveLabel(label)
      const sleeve = formatSleeve(parts.sleeve, parts.symbol)
      return parts.symbol ? `${sleeve} - ${formatSymbol(parts.symbol)}` : sleeve
    },
  }
}

export const obfuscatePerformanceRows = (rows: PerformanceRow[], obfuscation: ReportObfuscation) =>
  rows.map((row) => ({
    ...row,
    sleeve: obfuscation.formatSleeve(row.sleeve, row.symbol ?? ''),
    symbol: row.symbol ? obfuscation.formatSymbol(row.symbol) : row.symbol,
  }))

export const obfuscateRiskRows = (rows: RiskRow[], obfuscation: ReportObfuscation) =>
  rows.map((row) => ({
    ...row,
    sleeve: obfuscation.formatSleeve(row.sleeve, row.symbol ?? ''),
    symbol: row.symbol ? obfuscation.formatSymbol(row.symbol) : row.symbol,
  }))
