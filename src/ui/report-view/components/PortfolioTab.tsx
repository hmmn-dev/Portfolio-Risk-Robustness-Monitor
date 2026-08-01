import { Stack, useTheme } from '@mui/material'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { ALL_CHART_RANGE, type ChartRangeSelection } from '../helpers/chartRange'
import { getPortfolioSleeveLabels, usePortfolioComposition } from '../hooks/usePortfolioComposition'
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics'
import MonthlyReturnsTable from './portfolio/MonthlyReturnsTable'
import PortfolioAnalyticsFrame from './portfolio/PortfolioAnalyticsFrame'
import PortfolioChartsPanel from './portfolio/PortfolioChartsPanel'
import PortfolioCompositionDialog from './portfolio/PortfolioCompositionDialog'
import PortfolioCorrelationPanel from './portfolio/PortfolioCorrelationPanel'
import PortfolioSummaryPanel from './portfolio/PortfolioSummaryPanel'
import PortfolioToolbar from './portfolio/PortfolioToolbar'
import PortfolioRegressionSummary from './portfolio/summary/PortfolioRegressionSummary'
import { useReportPortfolio } from './ReportViewContext'

const PortfolioTabContent = () => {
  const theme = useTheme()
  const {
    report,
    deals,
    baseCapital,
    drawdownMode,
    onDrawdownModeChange,
    pnlScaleMode,
    onPnlScaleModeChange,
    portfolioDrawdown,
    portfolioDrawdownSource,
    showCorrNumbers,
    onShowCorrNumbersChange,
    correlationMatrix,
    correlationLegend,
    cellSize,
    portfolioSummary,
    riskRows,
    underlyingSeries,
  } = useReportPortfolio()
  const sleeveLabels = useMemo(() => getPortfolioSleeveLabels(report), [report])
  const composition = usePortfolioComposition(sleeveLabels)
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

  return (
    <Stack spacing={2}>
      <PortfolioToolbar
        enabledCount={composition.enabledCount}
        totalSleeves={composition.totalSleeves}
        modifiedWeightCount={composition.modifiedWeightCount}
        hasMtmDrawdown={analytics.mtmAvailable}
        drawdownMode={analytics.effectiveDrawdownMode}
        pnlScaleMode={pnlScaleMode}
        onOpenComposition={composition.dialog.openDialog}
        onDrawdownModeChange={onDrawdownModeChange}
        onPnlScaleModeChange={onPnlScaleModeChange}
      />
      <PortfolioAnalyticsFrame refreshing={isRefreshing}>
        <PortfolioChartsPanel
          index={analytics.chartIndex}
          drawdown={analytics.chartDrawdown}
          drawdownSource={analytics.effectiveDrawdownSource}
          pnlScaleMode={pnlScaleMode}
          baseCapital={baseCapital}
          rangeSelection={chartRangeSelection}
          onRangeSelectionChange={handleRangeSelectionChange}
        />
        <PortfolioSummaryPanel
          summary={analytics.effectiveSummary}
          index={analytics.effectiveIndex}
          returns={analytics.effectiveReturns}
          drawdown={analytics.effectiveDrawdown}
          drawdownMode={analytics.effectiveDrawdownMode}
          drawdownSource={analytics.effectiveDrawdownSource}
          riskRows={riskRows}
          customPortfolio={analytics.usesCustomPortfolio}
        />
        <MonthlyReturnsTable rows={analytics.monthlyReturns} theme={theme} />
        <PortfolioCorrelationPanel
          matrix={analytics.effectiveCorrelationMatrix}
          legend={correlationLegend}
          cellSize={cellSize}
          showNumbers={showCorrNumbers}
          theme={theme}
          onShowNumbersChange={onShowCorrNumbersChange}
        />
        <PortfolioRegressionSummary regression={analytics.effectiveSummary?.regression ?? null} />
      </PortfolioAnalyticsFrame>
      {composition.dialog.open && (
        <PortfolioCompositionDialog
          labels={sleeveLabels}
          enabledSleeves={composition.enabledSleeves}
          sleeveWeights={composition.sleeveWeights}
          modified={composition.isModified}
          onClose={closeCompositionDialog}
          onResetToBaseline={handleResetComposition}
          onApply={handleApplyComposition}
        />
      )}
    </Stack>
  )
}

const PortfolioTab = () => {
  const { report } = useReportPortfolio()
  const sleeveKey = getPortfolioSleeveLabels(report).join('||')
  return <PortfolioTabContent key={sleeveKey} />
}

export default PortfolioTab
