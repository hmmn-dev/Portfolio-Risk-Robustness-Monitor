import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { ALL_CHART_RANGE, type ChartRangeSelection } from '../helpers/chartRange'
import { getPortfolioSleeveLabels, usePortfolioComposition } from '../hooks/usePortfolioComposition'
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics'
import MonthlyReturnsTable from './portfolio/MonthlyReturnsTable'
import PortfolioChartsPanel from './portfolio/PortfolioChartsPanel'
import PortfolioCompositionDialog from './portfolio/PortfolioCompositionDialog'
import PortfolioCorrelationPanel from './portfolio/PortfolioCorrelationPanel'
import PortfolioSummaryPanel from './portfolio/PortfolioSummaryPanel'
import PortfolioToolbar from './portfolio/PortfolioToolbar'
import PortfolioRegressionSummary from './portfolio/summary/PortfolioRegressionSummary'
import { useReportPortfolio } from './ReportViewContext'

const PortfolioTabContent = () => {
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
    pnlColor,
    axisColor,
    gridColor,
    showCorrNumbers,
    onShowCorrNumbersChange,
    correlationMatrix,
    correlationLegend,
    cellSize,
    theme,
    portfolioSummary,
    riskRows,
    underlyingSeries,
  } = useReportPortfolio()
  const sleeveLabels = useMemo(() => getPortfolioSleeveLabels(report), [report])
  const composition = usePortfolioComposition(sleeveLabels)
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
      <PortfolioChartsPanel
        index={analytics.chartIndex}
        drawdown={analytics.chartDrawdown}
        drawdownSource={analytics.effectiveDrawdownSource}
        pnlScaleMode={pnlScaleMode}
        baseCapital={baseCapital}
        pnlColor={pnlColor}
        axisColor={axisColor}
        gridColor={gridColor}
        rangeSelection={chartRangeSelection}
        onRangeSelectionChange={handleRangeSelectionChange}
      />
      <Box aria-busy={isRefreshing}>
        {isRefreshing && (
          <Stack
            role="status"
            aria-live="polite"
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ minHeight: 24, mb: 1, color: 'text.secondary' }}
          >
            <CircularProgress size={16} thickness={5} color="inherit" />
            <Typography variant="caption">Refreshing portfolio analytics</Typography>
          </Stack>
        )}
        <Stack
          spacing={2}
          sx={{
            opacity: isRefreshing ? 0.68 : 1,
            transition: (activeTheme) =>
              activeTheme.transitions.create('opacity', {
                duration: activeTheme.transitions.duration.shorter,
              }),
          }}
        >
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
        </Stack>
      </Box>
      <PortfolioCompositionDialog
        open={composition.dialog.open}
        labels={sleeveLabels}
        sleeveDraft={composition.dialog.sleeveDraft}
        weightDraft={composition.dialog.weightDraft}
        globalWeightDraft={composition.dialog.globalWeightDraft}
        modified={composition.dialog.isModified}
        applyDisabled={composition.dialog.applyDisabled}
        onClose={composition.dialog.close}
        onToggleSleeve={composition.dialog.toggleSleeve}
        onSelectAll={composition.dialog.selectAll}
        onClear={composition.dialog.clear}
        onUpdateWeight={composition.dialog.updateWeight}
        onUpdateGlobalWeight={composition.dialog.updateGlobalWeight}
        onApplyGlobalWeight={composition.dialog.applyGlobalWeight}
        onResetWeights={composition.dialog.resetWeights}
        onResetToBaseline={composition.dialog.resetToBaseline}
        onApply={composition.dialog.apply}
      />
    </Stack>
  )
}

const PortfolioTab = () => {
  const { report } = useReportPortfolio()
  const sleeveKey = getPortfolioSleeveLabels(report).join('||')
  return <PortfolioTabContent key={sleeveKey} />
}

export default PortfolioTab
