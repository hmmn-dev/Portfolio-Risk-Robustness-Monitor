import { Stack } from '@mui/material'
import { useEffect, useMemo } from 'react'
import { getPortfolioSleeveLabels, usePortfolioComposition } from '../hooks/usePortfolioComposition'
import { usePortfolioAnalytics } from '../hooks/usePortfolioAnalytics'
import MonthlyReturnsTable from './portfolio/MonthlyReturnsTable'
import PortfolioChartsPanel from './portfolio/PortfolioChartsPanel'
import PortfolioCompositionDialog from './portfolio/PortfolioCompositionDialog'
import PortfolioCorrelationPanel from './portfolio/PortfolioCorrelationPanel'
import PortfolioSummaryPanel from './portfolio/PortfolioSummaryPanel'
import PortfolioToolbar from './portfolio/PortfolioToolbar'
import { useReportPortfolio } from './ReportViewContext'

const PortfolioTabContent = () => {
  const {
    report,
    deals,
    baseCapital,
    drawdownMode,
    onDrawdownModeChange,
    hasMtmDrawdown,
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
    underlyingTimeframes,
  } = useReportPortfolio()
  const sleeveLabels = useMemo(() => getPortfolioSleeveLabels(report), [report])
  const composition = usePortfolioComposition(sleeveLabels)
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
    underlyingTimeframes,
    enabledSleeves: composition.enabledSleeves,
    sleeveWeights: composition.sleeveWeights,
    isFiltered: composition.isFiltered,
    hasCustomWeights: composition.hasCustomWeights,
  })

  useEffect(() => {
    if (composition.isModified && drawdownMode === 'mtm') {
      onDrawdownModeChange('deal')
    }
  }, [composition.isModified, drawdownMode, onDrawdownModeChange])

  return (
    <Stack spacing={2}>
      <PortfolioToolbar
        enabledCount={composition.enabledCount}
        totalSleeves={composition.totalSleeves}
        modifiedWeightCount={composition.modifiedWeightCount}
        portfolioModified={composition.isModified}
        hasMtmDrawdown={hasMtmDrawdown}
        drawdownMode={drawdownMode}
        pnlScaleMode={pnlScaleMode}
        onOpenComposition={composition.dialog.openDialog}
        onDrawdownModeChange={onDrawdownModeChange}
        onPnlScaleModeChange={onPnlScaleModeChange}
      />
      <PortfolioChartsPanel
        index={analytics.effectiveIndex}
        drawdown={analytics.effectiveDrawdown}
        drawdownSource={analytics.effectiveDrawdownSource}
        pnlScaleMode={pnlScaleMode}
        baseCapital={baseCapital}
        pnlColor={pnlColor}
        axisColor={axisColor}
        gridColor={gridColor}
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
      <PortfolioSummaryPanel
        summary={analytics.effectiveSummary}
        drawdown={analytics.effectiveDrawdown}
        drawdownMode={analytics.effectiveDrawdownMode}
        drawdownSource={analytics.effectiveDrawdownSource}
        riskRows={riskRows}
        customPortfolio={analytics.usesCustomPortfolio}
      />
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
