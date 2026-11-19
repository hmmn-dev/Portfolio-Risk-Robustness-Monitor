import { resolvePortfolioPerformance } from '../../../engine/portfolioPerformance'
import { scalePortfolioEquityExposure } from '../../../engine/portfolioEquity'
import { useMemo } from 'react'
import { buildMtmDrawdown } from '../../../engine/mtmDrawdown'
import { toDayStart } from '../../../engine/portfolioSeriesHelpers'
import { computeTradeStats } from '../../../engine/tradeStats'
import type { DealRow, ReportModel, UnderlyingSeries } from '../../../engine/types'
import {
  applyDrawdownToSummary,
  buildContributionCorrelationMatrix,
  buildCustomPortfolioSummary,
  buildDailyReturnPoints,
  buildMonthlyReturnRows,
  buildRangePortfolioSummary,
  buildWeightedPortfolio,
} from '../portfolio/portfolioCalculations'
import type { CorrelationMatrix, PortfolioSummary } from '../types'
import type { DrawdownMode } from '../reportAnalytics'
import {
  filterSeriesByRange,
  getChartRangeBounds,
  resolveChartRange,
  type ChartRangeSelection,
} from '../helpers/chartRange'
import { normalizeSymbol } from '../helpers/labels'
import { portfolioRegression } from '../helpers/regression'
import { buildFactorRelationships } from '../portfolio/factorRelationships'

const DAY_MS = 24 * 60 * 60 * 1000

type UsePortfolioAnalyticsOptions = {
  report: ReportModel
  rawContributions?: ReportModel['contributions']
  deals: DealRow[] | null
  baseCapital: number
  drawdownMode: DrawdownMode
  portfolioDrawdown: ReportModel['portfolio']['drawdown']
  portfolioDrawdownFallback: ReportModel['portfolio']['drawdown']
  portfolioDrawdownSource?: ReportModel['portfolio']['drawdownSource']
  portfolioSummary: PortfolioSummary | null
  correlationMatrix: CorrelationMatrix
  underlyingSeries: UnderlyingSeries[]
  enabledSleeves: Set<string>
  sleeveWeights: Record<string, number>
  isFiltered: boolean
  hasCustomWeights: boolean
  rangeSelection: ChartRangeSelection
}

export const usePortfolioAnalytics = ({
  report,
  rawContributions,
  deals,
  baseCapital,
  drawdownMode,
  portfolioDrawdown,
  portfolioDrawdownFallback,
  portfolioDrawdownSource,
  portfolioSummary,
  correlationMatrix,
  underlyingSeries,
  enabledSleeves,
  sleeveWeights,
  isFiltered,
  hasCustomWeights,
  rangeSelection,
}: UsePortfolioAnalyticsOptions) => {
  const usesCustomPortfolio = isFiltered || hasCustomWeights
  const activeContributions = useMemo(
    () => report.contributions.filter((item) => enabledSleeves.has(item.sleeve)),
    [enabledSleeves, report.contributions],
  )
  const customPortfolio = useMemo(
    () =>
      usesCustomPortfolio
        ? buildWeightedPortfolio(report.portfolio.days, activeContributions, sleeveWeights)
        : null,
    [activeContributions, report.portfolio.days, sleeveWeights, usesCustomPortfolio],
  )
  const customPortfolioSummary = useMemo(
    () => buildCustomPortfolioSummary(customPortfolio),
    [customPortfolio],
  )
  const uniformEquityExposure = useMemo(() => {
    if (!usesCustomPortfolio || isFiltered || !report.portfolio.equity || !enabledSleeves.size) {
      return null
    }
    const weights = Array.from(enabledSleeves, (sleeve) => sleeveWeights[sleeve] ?? 1)
    const multiplier = weights[0]
    if (!weights.every((weight) => weight === multiplier)) return null
    const equity = scalePortfolioEquityExposure(report.portfolio.equity, multiplier)
    return equity ? { multiplier, equity } : null
  }, [enabledSleeves, isFiltered, report.portfolio.equity, sleeveWeights, usesCustomPortfolio])
  const customMtm = useMemo(() => {
    if (
      !usesCustomPortfolio ||
      uniformEquityExposure ||
      drawdownMode !== 'mtm' ||
      !deals?.length ||
      !underlyingSeries.length
    ) {
      return null
    }
    return buildMtmDrawdown(deals, underlyingSeries, baseCapital, {
      sleeves: enabledSleeves,
      sleeveWeights,
      includeRealizedFallback: true,
      baselineEquityIndex: report.portfolio.equity?.index,
    })
  }, [
    baseCapital,
    deals,
    drawdownMode,
    enabledSleeves,
    sleeveWeights,
    underlyingSeries,
    usesCustomPortfolio,
    report.portfolio.equity?.index,
    uniformEquityExposure,
  ])
  const customEquity = uniformEquityExposure?.equity ?? customMtm?.equity
  const hasCustomMtm = (customEquity?.index.length ?? 0) > 0
  const hasPortfolioMtm = (report.portfolio.drawdownMtm?.length ?? 0) > 0
  const canBuildCustomMtm =
    !!uniformEquityExposure ||
    (!!deals?.some((deal) => enabledSleeves.has(deal.sleeve)) && underlyingSeries.length > 0)
  const mtmAvailable = usesCustomPortfolio ? canBuildCustomMtm : hasPortfolioMtm
  const effectiveDrawdownMode: DrawdownMode =
    drawdownMode === 'mtm' && (usesCustomPortfolio ? hasCustomMtm : hasPortfolioMtm)
      ? 'mtm'
      : 'deal'
  const customDrawdownSeries = useMemo(() => {
    const realized = customPortfolio?.drawdown ?? []
    if (customEquity)
      return {
        drawdown: customEquity.drawdown,
        realizedFallback: uniformEquityExposure
          ? (customEquity.recordedOnlyDrawdown ?? [])
          : (customMtm?.realizedFallback ?? []),
      }
    return { drawdown: realized, realizedFallback: [] }
  }, [customEquity, customMtm, customPortfolio, uniformEquityExposure])
  const fullDrawdown = useMemo(
    () =>
      usesCustomPortfolio
        ? effectiveDrawdownMode === 'mtm'
          ? customDrawdownSeries.drawdown
          : (customPortfolio?.drawdown ?? [])
        : portfolioDrawdown,
    [
      customPortfolio?.drawdown,
      customDrawdownSeries.drawdown,
      effectiveDrawdownMode,
      portfolioDrawdown,
      usesCustomPortfolio,
    ],
  )
  const fullDrawdownFallback = useMemo(
    () =>
      effectiveDrawdownMode === 'mtm'
        ? usesCustomPortfolio
          ? customDrawdownSeries.realizedFallback
          : portfolioDrawdownFallback
        : [],
    [
      customDrawdownSeries.realizedFallback,
      effectiveDrawdownMode,
      portfolioDrawdownFallback,
      usesCustomPortfolio,
    ],
  )
  const effectiveDrawdownSource =
    effectiveDrawdownMode === 'mtm'
      ? usesCustomPortfolio
        ? customEquity?.source
        : portfolioDrawdownSource
      : usesCustomPortfolio
        ? report.portfolio.drawdownSource
        : portfolioDrawdownSource
  const performance = useMemo(() => {
    if (!usesCustomPortfolio) return resolvePortfolioPerformance(report, drawdownMode === 'mtm')
    const equity = effectiveDrawdownMode === 'mtm' ? customEquity : undefined
    return {
      chartIndex: equity?.index ?? customPortfolio?.index ?? [],
      index: equity?.dailyIndex ?? customPortfolio?.index ?? [],
      returns:
        equity?.dailyReturns ??
        buildDailyReturnPoints(report.portfolio.days, customPortfolio?.returns ?? []),
      source: equity?.source,
    }
  }, [
    customEquity,
    customPortfolio,
    drawdownMode,
    effectiveDrawdownMode,
    report,
    usesCustomPortfolio,
  ])
  const fullIndex = performance.index
  const fullReturns = performance.returns
  const fullSummary = useMemo(
    () =>
      applyDrawdownToSummary(
        usesCustomPortfolio
          ? performance.source
            ? buildRangePortfolioSummary(fullReturns, fullDrawdown, null)
            : customPortfolioSummary
          : portfolioSummary,
        fullDrawdown,
      ),
    [
      customPortfolioSummary,
      fullDrawdown,
      fullReturns,
      performance.source,
      portfolioSummary,
      usesCustomPortfolio,
    ],
  )
  const rangeBounds = useMemo(
    () => getChartRangeBounds(fullIndex, performance.chartIndex, fullDrawdown),
    [fullDrawdown, fullIndex, performance.chartIndex],
  )
  const resolvedRange = useMemo(
    () => resolveChartRange(rangeBounds, rangeSelection),
    [rangeBounds, rangeSelection],
  )
  const tradeStats = useMemo(
    () =>
      deals
        ? computeTradeStats(deals, {
            sleeves: enabledSleeves,
            startTime: resolvedRange?.minTime,
            endTime:
              resolvedRange == null ? undefined : toDayStart(resolvedRange.maxTime) + DAY_MS - 1,
          })
        : null,
    [deals, enabledSleeves, resolvedRange],
  )
  const isFullRange = rangeSelection.type === 'preset' && rangeSelection.preset === 'all'
  const effectiveIndex = useMemo(
    () => (isFullRange ? fullIndex : filterSeriesByRange(fullIndex, resolvedRange)),
    [fullIndex, isFullRange, resolvedRange],
  )
  const effectiveDrawdown = useMemo(
    () => (isFullRange ? fullDrawdown : filterSeriesByRange(fullDrawdown, resolvedRange)),
    [fullDrawdown, isFullRange, resolvedRange],
  )
  const effectiveReturns = useMemo(
    () => (isFullRange ? fullReturns : filterSeriesByRange(fullReturns, resolvedRange)),
    [fullReturns, isFullRange, resolvedRange],
  )
  const normalizedUnderlying = useMemo(
    () =>
      underlyingSeries.reduce<Record<string, UnderlyingSeries['daily']>>((normalized, series) => {
        const symbol = normalizeSymbol(series.symbol)
        if (symbol && !normalized[symbol]) normalized[symbol] = series.daily
        return normalized
      }, {}),
    [underlyingSeries],
  )
  const rangeRegression = useMemo(() => {
    if (isFullRange) return fullSummary?.regression ?? null
    if (usesCustomPortfolio || !resolvedRange) return null
    const portfolioDays = fullReturns
      .map((point) => ({ time: point.time, return: point.value }))
      .filter((day) => day.time >= resolvedRange.minTime && day.time <= resolvedRange.maxTime)
    const symbols = activeContributions
      .map((item) => normalizeSymbol(item.symbol))
      .filter((symbol) => symbol.length > 0)
    return portfolioRegression(portfolioDays, symbols, normalizedUnderlying)
  }, [
    activeContributions,
    fullSummary?.regression,
    isFullRange,
    normalizedUnderlying,
    fullReturns,
    resolvedRange,
    usesCustomPortfolio,
  ])
  const effectiveSummary = useMemo(
    () =>
      isFullRange
        ? fullSummary
        : buildRangePortfolioSummary(effectiveReturns, effectiveDrawdown, rangeRegression),
    [effectiveDrawdown, effectiveReturns, fullSummary, isFullRange, rangeRegression],
  )
  const monthlyReturns = useMemo(
    () => buildMonthlyReturnRows(effectiveReturns, effectiveDrawdown),
    [effectiveDrawdown, effectiveReturns],
  )
  const factorRelationships = useMemo(
    () =>
      buildFactorRelationships({
        portfolioReturns: effectiveReturns,
        contributions: activeContributions,
        rawContributions,
        weights: sleeveWeights,
        underlying: underlyingSeries,
      }),
    [activeContributions, effectiveReturns, rawContributions, sleeveWeights, underlyingSeries],
  )
  const effectiveCorrelationMatrix = useMemo(() => {
    if (isFullRange) {
      return isFiltered
        ? buildContributionCorrelationMatrix(activeContributions)
        : correlationMatrix
    }
    const rangedContributions = activeContributions.map((contribution) => ({
      ...contribution,
      returns: filterSeriesByRange(contribution.returns, resolvedRange),
    }))
    return buildContributionCorrelationMatrix(rangedContributions)
  }, [activeContributions, correlationMatrix, isFiltered, isFullRange, resolvedRange])

  return {
    usesCustomPortfolio,
    mtmAvailable,
    effectiveDrawdownMode,
    effectiveDrawdown,
    effectiveDrawdownSource,
    effectiveIndex,
    effectiveReturns,
    effectiveSummary,
    effectiveCorrelationMatrix,
    monthlyReturns,
    factorRelationships,
    tradeStats,
    equitySource: performance.source,
    equityExposureMultiplier:
      effectiveDrawdownMode === 'mtm' ? uniformEquityExposure?.multiplier : undefined,
    chartIndex: performance.chartIndex,
    chartDrawdown: fullDrawdown,
    chartDrawdownFallback: fullDrawdownFallback,
  }
}
