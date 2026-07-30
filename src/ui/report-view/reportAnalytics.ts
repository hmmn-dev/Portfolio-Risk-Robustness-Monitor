import { computeDdShock } from '../../engine/ddShock'
import { rollingOlsPairs, rollingSharpe, rollingWinrate } from '../../engine/statsRolling'
import { computeAlphaPercentiles, computeStatus } from '../../engine/status'
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
  getLastFinite,
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

export const resolvePortfolioDrawdown = (report: ReportModel | null, mode: DrawdownMode) =>
  mode === 'mtm' && report?.portfolio.drawdownMtm?.length
    ? report.portfolio.drawdownMtm
    : (report?.portfolio.drawdown ?? [])

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
  const minObs = Math.floor(window * 0.8)
  const minActive = Math.floor(window * 0.2)
  const hasUnderlying = !!underlying && underlying.length > 0
  const returnsMap = hasUnderlying ? buildReturnMap(underlying) : null
  const alignedPrimary = alignPairsByDay(item.returns, returnsMap ?? portfolioReturnMap)
  const alignedFallback = alignPairsByDay(item.returns, portfolioReturnMap)
  const useFallback = !hasUnderlying || (returnsMap && alignedPrimary.validCount < minObs)
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

export const buildRiskRows = (
  report: ReportModel,
  drawdownMode: DrawdownMode,
  normalizedUnderlying: NormalizedUnderlying,
  portfolioReturnMap: Map<number, number>,
): RiskRow[] =>
  report.contributions.map((item, index) => {
    const returns = sanitizeSeries(getSeriesValues(item.returns))
    const minObs = Math.floor(METRIC_WINDOW.long * 0.8)
    const minActive = Math.floor(METRIC_WINDOW.long * 0.2)
    const underlying = findUnderlyingForSymbol(normalizedUnderlying, item.symbol, item.sleeve)
    const returnsMap =
      underlying && underlying.length > 0 ? buildReturnMap(underlying) : portfolioReturnMap
    const alignedPrimary = alignPairsByDay(item.returns, returnsMap)
    const aligned =
      returnsMap !== portfolioReturnMap && alignedPrimary.validCount < minObs
        ? alignPairsByDay(item.returns, portfolioReturnMap)
        : alignedPrimary
    const alphaSeries = rollingOlsPairs(aligned.xs, aligned.ys, METRIC_WINDOW.long, {
      minObs,
      minActive,
    }).alpha
    const alphaPct = getLastFinite(computeAlphaPercentiles(alphaSeries))
    const last1YSharpe = getLastFinite(rollingSharpe(returns, METRIC_WINDOW.short))
    const last2YSharpe = getLastFinite(rollingSharpe(returns, METRIC_WINDOW.long))
    const overallSharpe = computeSharpe(returns)
    const winrateSeries = rollingWinrate(returns, METRIC_WINDOW.long)
    const last2YWinrate = getLastFinite(winrateSeries)
    const shock = computeDdShock(resolveSleeveDrawdown(item, drawdownMode)).flag
    const alphaPctFinite = Number.isFinite(alphaPct) ? alphaPct : null
    const redTriggers: string[] = []
    const yellowTriggers: string[] = []

    if (alphaPctFinite != null && alphaPctFinite < 15) {
      yellowTriggers.push('alpha pctile < 15')
    } else if (alphaPctFinite != null && alphaPctFinite < 40) {
      yellowTriggers.push('alpha pctile 15–40')
    }
    const hasNegativeSharpe = Number.isFinite(overallSharpe) && overallSharpe < 0
    if (hasNegativeSharpe) redTriggers.push('Overall Sharpe < 0')
    if (Number.isFinite(last1YSharpe) && last1YSharpe < 0) {
      yellowTriggers.push('1Y Sharpe < 0')
    }
    if (shock === 'ORANGE') {
      yellowTriggers.push('dd shock ORANGE')
      if (hasNegativeSharpe) redTriggers.push('dd shock ORANGE')
    }
    if (shock === 'RED') redTriggers.push('dd shock RED')

    const status = computeStatus({
      alphaSeries,
      winrateSeries,
      last1YSharpe: Number.isFinite(last1YSharpe) ? last1YSharpe : null,
      last2YSharpe: Number.isFinite(last2YSharpe) ? last2YSharpe : null,
      overallSharpe: Number.isFinite(overallSharpe) ? overallSharpe : null,
      last2YWinrate: Number.isFinite(last2YWinrate) ? last2YWinrate : null,
      shock,
    })
    const statusReasons =
      status.status === 'RED'
        ? `Reason: ${redTriggers.length > 0 ? redTriggers.join('; ') : 'Overall Sharpe < 0'}.`
        : status.status === 'YELLOW'
          ? `Reason: ${yellowTriggers.length > 0 ? yellowTriggers.join('; ') : 'insufficient signal for green'}.`
          : 'Reason: alpha pctile >= 40 and 2Y Sharpe > 0.5.'
    const statusAction =
      status.status === 'RED'
        ? 'Reduce weight 50–100%, recheck in 3 months.'
        : status.status === 'YELLOW'
          ? 'Keep weight, recheck in 4–6 weeks.'
          : 'No change.'
    const sleeveParts = splitSleeveLabel(item.sleeve)

    return {
      id: index,
      sleeve: sleeveParts.sleeve,
      symbol: sleeveParts.symbol || item.symbol,
      status: status.status,
      shock: status.shock,
      alphaPct: Number.isFinite(alphaPct) ? alphaPct : null,
      winratePctile: status.winratePercentile,
      last1ySharpe: status.last1YSharpe,
      last2ySharpe: status.last2YSharpe,
      overallSharpe: status.overallSharpe,
      last2yWinrate: status.last2YWinrate,
      statusReasons,
      statusAction,
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
