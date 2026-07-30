import { useCallback, useMemo } from 'react'
import { stableSort } from '../../../engine/stableSort'
import type { ReportModel, UnderlyingSeries } from '../../../engine/types'
import { buildReturnMap, resolveBaseCapital } from '../helpers'
import {
  buildCorrelationMatrix,
  buildPerformanceRows,
  buildPortfolioSummary,
  buildReportObfuscation,
  buildRiskRows,
  buildUnderlyingTimeframes,
  computeSleeveMetrics,
  findUnderlyingForSymbol,
  normalizeUnderlyingBySymbol,
  obfuscatePerformanceRows,
  obfuscateRiskRows,
  resolvePortfolioDrawdown,
  resolvePortfolioDrawdownSource,
  resolveSleeveDrawdown,
  resolveSleeveDrawdownSource,
  type DrawdownMode,
} from '../reportAnalytics'

type UseReportAnalyticsOptions = {
  report: ReportModel | null
  underlyingBySymbol: Record<string, UnderlyingSeries>
  drawdownMode: DrawdownMode
  rollingWindow: number
  selectedSleeve: string | null
  pdfObfuscate: boolean
  pdfPageWidth: number
  pdfCellSize: number
}

export const useReportAnalytics = ({
  report,
  underlyingBySymbol,
  drawdownMode,
  rollingWindow,
  selectedSleeve,
  pdfObfuscate,
  pdfPageWidth,
  pdfCellSize,
}: UseReportAnalyticsOptions) => {
  const portfolioReturnMap = useMemo(() => buildReturnMap(report?.portfolio.days ?? []), [report])
  const baseCapital = useMemo(
    () => resolveBaseCapital(report?.portfolio.days ?? [], 10000),
    [report],
  )
  const normalizedUnderlying = useMemo(
    () => normalizeUnderlyingBySymbol(underlyingBySymbol),
    [underlyingBySymbol],
  )
  const underlyingSeries = useMemo(() => Object.values(underlyingBySymbol), [underlyingBySymbol])
  const underlyingTimeframes = useMemo(
    () => buildUnderlyingTimeframes(underlyingBySymbol),
    [underlyingBySymbol],
  )
  const portfolioDrawdown = useMemo(
    () => resolvePortfolioDrawdown(report, drawdownMode),
    [drawdownMode, report],
  )
  const portfolioDrawdownSource = useMemo(
    () => resolvePortfolioDrawdownSource(report, drawdownMode),
    [drawdownMode, report],
  )
  const getSleeveDrawdown = useCallback(
    (item: ReportModel['contributions'][number] | null) =>
      resolveSleeveDrawdown(item, drawdownMode),
    [drawdownMode],
  )
  const getSleeveDrawdownSource = useCallback(
    (item: ReportModel['contributions'][number] | null) =>
      resolveSleeveDrawdownSource(item, drawdownMode),
    [drawdownMode],
  )
  const getUnderlyingForSymbol = useCallback(
    (symbol: string, sleeveLabel: string) =>
      findUnderlyingForSymbol(normalizedUnderlying, symbol, sleeveLabel),
    [normalizedUnderlying],
  )
  const buildSleeveMetrics = useCallback(
    (item: ReportModel['contributions'][number]) =>
      report
        ? computeSleeveMetrics(
            item,
            portfolioReturnMap,
            rollingWindow,
            getUnderlyingForSymbol(item.symbol, item.sleeve),
          )
        : null,
    [getUnderlyingForSymbol, portfolioReturnMap, report, rollingWindow],
  )
  const portfolioSummary = useMemo(
    () => (report ? buildPortfolioSummary(report, portfolioDrawdown, normalizedUnderlying) : null),
    [normalizedUnderlying, portfolioDrawdown, report],
  )
  const sleeves = useMemo(
    () =>
      report
        ? stableSort(
            report.contributions.map((item) => item.sleeve),
            (a, b) => a.localeCompare(b),
          )
        : [],
    [report],
  )
  const selectedContribution = useMemo(() => {
    if (!report) return null
    const sleeve = selectedSleeve ?? report.contributions[0]?.sleeve
    return report.contributions.find((item) => item.sleeve === sleeve) ?? null
  }, [report, selectedSleeve])
  const selectedSleeveMetrics = useMemo(
    () => (selectedContribution ? buildSleeveMetrics(selectedContribution) : null),
    [buildSleeveMetrics, selectedContribution],
  )
  const performanceRows = useMemo(() => (report ? buildPerformanceRows(report) : []), [report])
  const riskRows = useMemo(
    () =>
      report ? buildRiskRows(report, drawdownMode, normalizedUnderlying, portfolioReturnMap) : [],
    [drawdownMode, normalizedUnderlying, portfolioReturnMap, report],
  )
  const correlationMatrix = useMemo(
    () => (report ? buildCorrelationMatrix(report) : { labels: [], values: [] }),
    [report],
  )
  const pdfObfuscation = useMemo(
    () => (report ? buildReportObfuscation(report, portfolioSummary) : null),
    [portfolioSummary, report],
  )
  const pdfPerformanceRows = useMemo(
    () =>
      pdfObfuscate && pdfObfuscation
        ? obfuscatePerformanceRows(performanceRows, pdfObfuscation)
        : performanceRows,
    [pdfObfuscate, pdfObfuscation, performanceRows],
  )
  const pdfRiskRows = useMemo(
    () => (pdfObfuscate && pdfObfuscation ? obfuscateRiskRows(riskRows, pdfObfuscation) : riskRows),
    [pdfObfuscate, pdfObfuscation, riskRows],
  )
  const pdfCorrelationLabels = useMemo(
    () =>
      pdfObfuscate && pdfObfuscation
        ? correlationMatrix.labels.map(pdfObfuscation.formatSleeveLabel)
        : correlationMatrix.labels,
    [correlationMatrix.labels, pdfObfuscate, pdfObfuscation],
  )
  const pdfCorrelationCellSize = useMemo(() => {
    if (pdfCorrelationLabels.length === 0) return pdfCellSize
    const candidate = Math.floor(Math.max(0, pdfPageWidth - 64) / (pdfCorrelationLabels.length + 1))
    return Math.max(16, Math.min(pdfCellSize, candidate))
  }, [pdfCellSize, pdfCorrelationLabels.length, pdfPageWidth])
  const formatPdfSymbol = useCallback(
    (value: string) =>
      pdfObfuscate && pdfObfuscation ? pdfObfuscation.formatSymbol(value) : value,
    [pdfObfuscate, pdfObfuscation],
  )
  const formatPdfSleeveLabel = useCallback(
    (value: string) =>
      pdfObfuscate && pdfObfuscation ? pdfObfuscation.formatSleeveLabel(value) : value,
    [pdfObfuscate, pdfObfuscation],
  )

  return {
    portfolioReturnMap,
    baseCapital,
    underlyingSeries,
    underlyingTimeframes,
    portfolioDrawdown,
    portfolioDrawdownSource,
    getSleeveDrawdown,
    getSleeveDrawdownSource,
    buildSleeveMetrics,
    portfolioSummary,
    sleeves,
    selectedContribution,
    selectedSleeveMetrics,
    performanceRows,
    riskRows,
    correlationMatrix,
    pdfPerformanceRows,
    pdfRiskRows,
    pdfCorrelationLabels,
    pdfCorrelationCellSize,
    formatPdfSymbol,
    formatPdfSleeveLabel,
  }
}
