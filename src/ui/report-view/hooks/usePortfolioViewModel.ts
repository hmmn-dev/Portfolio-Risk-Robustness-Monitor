import { useCallback, useMemo, useState, useTransition } from 'react'
import type { ReportPortfolioContextValue } from '../components/ReportViewContext'
import { ALL_CHART_RANGE, type ChartRangeSelection } from '../helpers/chartRange'
import { usePortfolioAnalytics } from './usePortfolioAnalytics'
import { getPortfolioSleeveLabels, usePortfolioComposition } from './usePortfolioComposition'

type PortfolioViewModelOptions = Pick<
  ReportPortfolioContextValue,
  | 'report'
  | 'deals'
  | 'appliedComposition'
  | 'onApplyComposition'
  | 'onResetComposition'
  | 'baseCapital'
  | 'drawdownMode'
  | 'portfolioDrawdown'
  | 'portfolioDrawdownFallback'
  | 'portfolioDrawdownSource'
  | 'portfolioSummary'
  | 'correlationMatrix'
  | 'underlyingSeries'
>

export const usePortfolioViewModel = ({
  report,
  deals,
  appliedComposition,
  onApplyComposition,
  onResetComposition,
  baseCapital,
  drawdownMode,
  portfolioDrawdown,
  portfolioDrawdownFallback,
  portfolioDrawdownSource,
  portfolioSummary,
  correlationMatrix,
  underlyingSeries,
}: PortfolioViewModelOptions) => {
  const sleeveLabels = useMemo(() => getPortfolioSleeveLabels(report), [report])
  const composition = usePortfolioComposition(sleeveLabels, {
    appliedComposition,
    onApplyComposition,
    onResetComposition,
  })
  const {
    apply: applyComposition,
    close: closeCompositionDialog,
    resetToBaseline: resetCompositionToBaseline,
  } = composition.dialog
  const [chartRangeSelection, setChartRangeSelection] =
    useState<ChartRangeSelection>(ALL_CHART_RANGE)
  const [analyticsRangeSelection, setAnalyticsRangeSelection] =
    useState<ChartRangeSelection>(ALL_CHART_RANGE)
  const [isRefreshing, startAnalyticsTransition] = useTransition()
  const handleRangeSelectionChange = useCallback(
    (selection: ChartRangeSelection) => {
      setChartRangeSelection(selection)
      startAnalyticsTransition(() => {
        setAnalyticsRangeSelection(selection)
      })
    },
    [startAnalyticsTransition],
  )
  const handleApplyComposition = useCallback(
    (nextSleeves: ReadonlySet<string>, nextWeights: Record<string, number>) => {
      closeCompositionDialog()
      startAnalyticsTransition(() => {
        applyComposition(nextSleeves, nextWeights)
      })
    },
    [applyComposition, closeCompositionDialog, startAnalyticsTransition],
  )
  const handleResetComposition = useCallback(() => {
    startAnalyticsTransition(() => {
      resetCompositionToBaseline()
    })
  }, [resetCompositionToBaseline, startAnalyticsTransition])
  const analytics = usePortfolioAnalytics({
    report,
    deals,
    baseCapital,
    drawdownMode,
    portfolioDrawdown,
    portfolioDrawdownFallback,
    portfolioDrawdownSource,
    portfolioSummary,
    correlationMatrix,
    underlyingSeries,
    enabledSleeves: composition.enabledSleeves,
    sleeveWeights: composition.sleeveWeights,
    isFiltered: composition.isFiltered,
    hasCustomWeights: composition.hasCustomWeights,
    rangeSelection: analyticsRangeSelection,
  })

  return {
    analytics,
    composition,
    sleeveLabels,
    chartRangeSelection,
    isRefreshing,
    onRangeSelectionChange: handleRangeSelectionChange,
    onApplyComposition: handleApplyComposition,
    onResetComposition: handleResetComposition,
  }
}

export type PortfolioViewModel = ReturnType<typeof usePortfolioViewModel>
