import { Stack, useTheme } from '@mui/material'
import type { PortfolioViewModel } from '../hooks/usePortfolioViewModel'
import MonthlyReturnsTable from './portfolio/MonthlyReturnsTable'
import PortfolioAnalyticsFrame from './portfolio/PortfolioAnalyticsFrame'
import PortfolioChartsPanel from './portfolio/PortfolioChartsPanel'
import PortfolioCompositionDialog from './portfolio/PortfolioCompositionDialog'
import PortfolioCorrelationPanel from './portfolio/PortfolioCorrelationPanel'
import PortfolioSummaryPanel from './portfolio/PortfolioSummaryPanel'
import PortfolioToolbar from './portfolio/PortfolioToolbar'
import PortfolioRegressionSummary from './portfolio/summary/PortfolioRegressionSummary'
import { useReportPortfolio } from './ReportViewContext'

type PortfolioTabProps = {
  viewModel: PortfolioViewModel
}

const PortfolioTab = ({ viewModel }: PortfolioTabProps) => {
  const theme = useTheme()
  const {
    baseCapital,
    onDrawdownModeChange,
    pnlScaleMode,
    onPnlScaleModeChange,
    showCorrNumbers,
    onShowCorrNumbersChange,
    correlationLegend,
    cellSize,
    riskRows,
  } = useReportPortfolio()
  const {
    analytics,
    composition,
    sleeveLabels,
    chartRangeSelection,
    isRefreshing,
    onRangeSelectionChange,
    onApplyComposition,
    onResetComposition,
  } = viewModel

  return (
    <Stack spacing={2}>
      <PortfolioToolbar
        enabledCount={composition.enabledCount}
        totalSleeves={composition.totalSleeves}
        customPortfolio={composition.isModified}
        modifiedWeightCount={composition.modifiedWeightCount}
        hasMtmDrawdown={analytics.mtmAvailable}
        drawdownMode={analytics.effectiveDrawdownMode}
        pnlScaleMode={pnlScaleMode}
        onOpenComposition={composition.dialog.openDialog}
        onResetToBaseline={onResetComposition}
        onDrawdownModeChange={onDrawdownModeChange}
        onPnlScaleModeChange={onPnlScaleModeChange}
      />
      <PortfolioAnalyticsFrame refreshing={isRefreshing}>
        <PortfolioChartsPanel
          index={analytics.chartIndex}
          drawdown={analytics.chartDrawdown}
          drawdownFallback={analytics.chartDrawdownFallback}
          drawdownSource={analytics.effectiveDrawdownSource}
          pnlScaleMode={pnlScaleMode}
          baseCapital={baseCapital}
          rangeSelection={chartRangeSelection}
          onRangeSelectionChange={onRangeSelectionChange}
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
          onClose={composition.dialog.close}
          onResetToBaseline={onResetComposition}
          onApply={onApplyComposition}
        />
      )}
    </Stack>
  )
}

export default PortfolioTab
