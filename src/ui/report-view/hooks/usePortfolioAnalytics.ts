import { useMemo } from 'react'
import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import type { DealRow, ReportModel, UnderlyingSeries } from '../../../engine/types'
import {
  applyDrawdownToSummary,
  buildContributionCorrelationMatrix,
  buildCustomPortfolioSummary,
  buildDailyReturnPoints,
  buildMonthlyReturnRows,
  buildWeightedPortfolio,
} from '../portfolio/portfolioCalculations'
import type { CorrelationMatrix, PortfolioSummary } from '../types'
import type { DrawdownMode } from '../reportAnalytics'

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
  underlyingTimeframes: Record<string, 'H1' | 'D1'>
  enabledSleeves: Set<string>
  sleeveWeights: Record<string, number>
  isFiltered: boolean
  hasCustomWeights: boolean
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
  underlyingTimeframes,
  enabledSleeves,
  sleeveWeights,
  isFiltered,
  hasCustomWeights,
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
  const filteredCorrelationMatrix = useMemo(
    () => buildContributionCorrelationMatrix(activeContributions),
    [activeContributions],
  )
  const filteredMtm = useMemo(() => {
    if (!isFiltered || drawdownMode !== 'mtm' || !deals?.length || !underlyingSeries.length) {
      return null
    }
    const filteredDeals = deals.filter((deal) => enabledSleeves.has(deal.sleeve))
    if (filteredDeals.length === 0) return null
    const filteredReport = buildPortfolioReport(filteredDeals, {
      generatedAt: report.generatedAt,
      dealsSourceName: report.dealsSourceName,
      underlyingTimeframes,
      underlyingSeries,
      initialCapital: baseCapital,
    })
    return {
      drawdown: filteredReport.portfolio.drawdownMtm ?? [],
      source: filteredReport.portfolio.drawdownMtmSource,
    }
  }, [
    baseCapital,
    deals,
    drawdownMode,
    enabledSleeves,
    isFiltered,
    report.dealsSourceName,
    report.generatedAt,
    underlyingSeries,
    underlyingTimeframes,
  ])
  const hasFilteredMtm = (filteredMtm?.drawdown.length ?? 0) > 0
  const hasPortfolioMtm = (report.portfolio.drawdownMtm?.length ?? 0) > 0
  const effectiveDrawdownMode: DrawdownMode =
    drawdownMode === 'mtm' && (!isFiltered ? hasPortfolioMtm : hasFilteredMtm) ? 'mtm' : 'deal'
  const effectiveDrawdown = useMemo(
    () =>
      effectiveDrawdownMode === 'mtm'
        ? isFiltered
          ? (filteredMtm?.drawdown ?? [])
          : (report.portfolio.drawdownMtm ?? portfolioDrawdown)
        : usesCustomPortfolio
          ? (customPortfolio?.drawdown ?? [])
          : portfolioDrawdown,
    [
      customPortfolio?.drawdown,
      effectiveDrawdownMode,
      filteredMtm?.drawdown,
      isFiltered,
      portfolioDrawdown,
      report.portfolio.drawdownMtm,
      usesCustomPortfolio,
    ],
  )
  const effectiveDrawdownSource =
    effectiveDrawdownMode === 'mtm'
      ? isFiltered
        ? filteredMtm?.source
        : report.portfolio.drawdownMtmSource
      : portfolioDrawdownSource
  const effectiveIndex = usesCustomPortfolio
    ? (customPortfolio?.index ?? [])
    : report.portfolio.index
  const dailyReturns = useMemo(
    () =>
      buildDailyReturnPoints(
        report.portfolio.days,
        usesCustomPortfolio ? (customPortfolio?.returns ?? []) : undefined,
      ),
    [customPortfolio?.returns, report.portfolio.days, usesCustomPortfolio],
  )
  const effectiveSummary = useMemo(
    () =>
      applyDrawdownToSummary(
        usesCustomPortfolio ? customPortfolioSummary : portfolioSummary,
        effectiveDrawdown,
      ),
    [customPortfolioSummary, effectiveDrawdown, portfolioSummary, usesCustomPortfolio],
  )
  const monthlyReturns = useMemo(
    () => buildMonthlyReturnRows(dailyReturns, effectiveDrawdown),
    [dailyReturns, effectiveDrawdown],
  )

  return {
    usesCustomPortfolio,
    effectiveDrawdownMode,
    effectiveDrawdown,
    effectiveDrawdownSource,
    effectiveIndex,
    effectiveSummary,
    effectiveCorrelationMatrix: isFiltered ? filteredCorrelationMatrix : correlationMatrix,
    monthlyReturns,
  }
}
