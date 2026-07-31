import { buildDailyReturnPoints, buildMonthlyReturnRows } from '../portfolio/portfolioCalculations'
import PortfolioChartsPage from './pdf/PortfolioChartsPage'
import PortfolioCorrelationPage from './pdf/PortfolioCorrelationPage'
import PortfolioMonthlyReturnsPage from './pdf/PortfolioMonthlyReturnsPage'
import PortfolioSummaryPage from './pdf/PortfolioSummaryPage'
import ReportSleevePages from './pdf/ReportSleevePages'
import ReportTablePages from './pdf/ReportTablePages'
import { useReportPdf } from './ReportViewContext'

const ReportPdf = () => {
  const {
    report,
    pdfName,
    pdfPageWidth,
    pdfPageMinHeight,
    pdfPerformanceColumns,
    pdfPerformanceRows,
    pdfRiskColumns,
    pdfRiskRows,
    riskRows,
    baseCapital,
    portfolioDrawdown,
    portfolioDrawdownSource,
    drawdownMode,
    pnlScaleMode,
    printPnlColor,
    printAxisColor,
    printGridColor,
    pdfCorrelationCellSize,
    pdfCorrelationLabels,
    correlationMatrix,
    correlationLegend,
    showCorrNumbers,
    lightTheme,
    formatPdfSleeveLabel,
    formatPdfSymbol,
    portfolioSummary,
    buildSleeveMetrics,
    getSleeveDrawdown,
    getSleeveDrawdownSource,
  } = useReportPdf()
  const dailyReturns = buildDailyReturnPoints(report.portfolio.days)
  const monthlyReturns = buildMonthlyReturnRows(dailyReturns, portfolioDrawdown)

  return (
    <>
      <ReportTablePages
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
        performanceColumns={pdfPerformanceColumns}
        performanceRows={pdfPerformanceRows}
        riskColumns={pdfRiskColumns}
        riskRows={pdfRiskRows}
      />
      <ReportSleevePages
        report={report}
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
        baseCapital={baseCapital}
        pnlScaleMode={pnlScaleMode}
        pnlColor={printPnlColor}
        axisColor={printAxisColor}
        gridColor={printGridColor}
        buildMetrics={buildSleeveMetrics}
        getDrawdown={getSleeveDrawdown}
        getDrawdownSource={getSleeveDrawdownSource}
        formatLabel={formatPdfSleeveLabel}
      />
      <PortfolioChartsPage
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
        index={report.portfolio.index}
        drawdown={portfolioDrawdown}
        drawdownSource={portfolioDrawdownSource}
        pnlScaleMode={pnlScaleMode}
        baseCapital={baseCapital}
        pnlColor={printPnlColor}
        axisColor={printAxisColor}
        gridColor={printGridColor}
      />
      <PortfolioMonthlyReturnsPage
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
        rows={monthlyReturns}
        theme={lightTheme}
      />
      <PortfolioCorrelationPage
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
        labels={pdfCorrelationLabels}
        matrix={correlationMatrix}
        cellSize={pdfCorrelationCellSize}
        legend={correlationLegend}
        showNumbers={showCorrNumbers}
        theme={lightTheme}
      />
      <PortfolioSummaryPage
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
        summary={portfolioSummary}
        index={report.portfolio.index}
        returns={dailyReturns}
        drawdown={portfolioDrawdown}
        drawdownMode={drawdownMode}
        drawdownSource={portfolioDrawdownSource}
        riskRows={riskRows}
        formatSymbol={formatPdfSymbol}
      />
    </>
  )
}

export default ReportPdf
