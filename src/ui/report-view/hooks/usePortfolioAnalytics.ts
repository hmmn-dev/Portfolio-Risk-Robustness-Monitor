import { useMemo } from 'react'
import { buildMtmDrawdown } from '../../../engine/mtmDrawdown'
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

type UsePortfolioAnalyticsOptions = {
  report: ReportModel
  deals: DealRow[] | null
  baseCapital: number
  drawdownMode: DrawdownMode
  portfolioDrawdown: ReportModel['portfolio']['drawdown']
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
  deals,
  baseCapital,
  drawdownMode,
  portfolioDrawdown,
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
  const customMtm = useMemo(() => {
    if (
      !usesCustomPortfolio ||
      drawdownMode !== 'mtm' ||
      !deals?.length ||
      !underlyingSeries.length
    ) {
      return null
    }
    return buildMtmDrawdown(deals, underlyingSeries, baseCapital, {
      sleeves: enabledSleeves,
      sleeveWeights,
    })
  }, [
    baseCapital,
    deals,
    drawdownMode,
    enabledSleeves,
    sleeveWeights,
    underlyingSeries,
    usesCustomPortfolio,
  ])
  const hasCustomMtm = (customMtm?.drawdown.length ?? 0) > 0
  const hasPortfolioMtm = (report.portfolio.drawdownMtm?.length ?? 0) > 0
  const canBuildCustomMtm =
    !!deals?.some((deal) => enabledSleeves.has(deal.sleeve)) && underlyingSeries.length > 0
  const mtmAvailable = usesCustomPortfolio ? canBuildCustomMtm : hasPortfolioMtm
  const effectiveDrawdownMode: DrawdownMode =
    drawdownMode === 'mtm' && (usesCustomPortfolio ? hasCustomMtm : hasPortfolioMtm)
      ? 'mtm'
      : 'deal'
  const fullDrawdown = useMemo(
    () =>
      effectiveDrawdownMode === 'mtm'
        ? usesCustomPortfolio
          ? (customMtm?.drawdown ?? [])
          : (report.portfolio.drawdownMtm ?? portfolioDrawdown)
        : usesCustomPortfolio
          ? (customPortfolio?.drawdown ?? [])
          : portfolioDrawdown,
    [
      customPortfolio?.drawdown,
      customMtm?.drawdown,
      effectiveDrawdownMode,
      portfolioDrawdown,
      report.portfolio.drawdownMtm,
      usesCustomPortfolio,
    ],
  )
  const effectiveDrawdownSource =
    effectiveDrawdownMode === 'mtm'
      ? usesCustomPortfolio
        ? customMtm?.source
        : report.portfolio.drawdownMtmSource
      : usesCustomPortfolio
        ? report.portfolio.drawdownSource
        : portfolioDrawdownSource
  const fullIndex = useMemo(
    () => (usesCustomPortfolio ? (customPortfolio?.index ?? []) : report.portfolio.index),
    [customPortfolio?.index, report.portfolio.index, usesCustomPortfolio],
  )
  const fullReturns = useMemo(
    () =>
      buildDailyReturnPoints(
        report.portfolio.days,
        usesCustomPortfolio ? (customPortfolio?.returns ?? []) : undefined,
      ),
    [customPortfolio?.returns, report.portfolio.days, usesCustomPortfolio],
  )
  const fullSummary = useMemo(
    () =>
      applyDrawdownToSummary(
        usesCustomPortfolio ? customPortfolioSummary : portfolioSummary,
        fullDrawdown,
      ),
    [customPortfolioSummary, fullDrawdown, portfolioSummary, usesCustomPortfolio],
  )
  const rangeBounds = useMemo(
    () => getChartRangeBounds(fullIndex, fullDrawdown),
    [fullDrawdown, fullIndex],
  )
  const resolvedRange = useMemo(
    () => resolveChartRange(rangeBounds, rangeSelection),
    [rangeBounds, rangeSelection],
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
    const portfolioDays = report.portfolio.days.filter(
      (day) => day.time >= resolvedRange.minTime && day.time <= resolvedRange.maxTime,
    )
    const symbols = activeContributions
      .map((item) => normalizeSymbol(item.symbol))
      .filter((symbol) => symbol.length > 0)
    return portfolioRegression(portfolioDays, symbols, normalizedUnderlying)
  }, [
    activeContributions,
    fullSummary?.regression,
    isFullRange,
    normalizedUnderlying,
    report.portfolio.days,
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
    chartIndex: fullIndex,
    chartDrawdown: fullDrawdown,
  }
}
