import { Stack, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useReportStore } from '../../store/report'
import { useUnderlyingStore } from '../../store/underlying'
import { useWizardStore } from '../../store/wizard'
import { createAppTheme } from '../../theme'
import { heatmapPalette } from './colors'
import MarDegradationDialog from './components/MarDegradationDialog'
import PdfSettingsDialog from './components/PdfSettingsDialog'
import ReportBusyOverlays from './components/ReportBusyOverlays'
import ReportHeader from './components/ReportHeader'
import ReportPdfRenderer from './components/ReportPdfRenderer'
import ReportTabsContent from './components/ReportTabsContent'
import type { ReportViewContextValue } from './components/ReportViewContext'
import ReportViewProvider from './components/ReportViewProvider'
import { useMarDegradation } from './hooks/useMarDegradation'
import { usePdfExport } from './hooks/usePdfExport'
import { useReportAnalytics } from './hooks/useReportAnalytics'
import { METRIC_WINDOW, type DrawdownMode } from './reportAnalytics'
import {
  createPerformanceColumns,
  createRiskColumns,
  PDF_PERFORMANCE_COLUMNS,
  PDF_RISK_COLUMNS,
} from './reportColumns'
import type { ReportTab } from './types'

const ALL_SLEEVES_PLACEHOLDER_HEIGHT = 720
const PDF_CELL_SIZE = 28
const PRINT_THEME = createAppTheme('light')
const CORRELATION_LEGEND = `linear-gradient(90deg, ${heatmapPalette
  .map((color, index) => `${color} ${(index / (heatmapPalette.length - 1)) * 100}%`)
  .join(', ')})`

const ReportView = () => {
  const report = useReportStore((state) => state.report)
  const baseReport = useReportStore((state) => state.baseReport)
  const deals = useReportStore((state) => state.deals)
  const baseDeals = useReportStore((state) => state.baseDeals)
  const marDegradationPct = useReportStore((state) => state.marDegradationPct)
  const clearReport = useReportStore((state) => state.clearReport)
  const setReport = useReportStore((state) => state.setReport)
  const setMarDegradationPct = useReportStore((state) => state.setMarDegradationPct)
  const underlyingBySymbol = useUnderlyingStore((state) => state.seriesBySymbol)
  const clearUnderlying = useUnderlyingStore((state) => state.clearUnderlying)
  const resetWizard = useWizardStore((state) => state.resetWizard)
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const hasMtmDrawdown = !!report?.portfolio.drawdownMtm?.length
  const [tab, setTab] = useState<ReportTab>('performance')
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null)
  const [rollingWindow, setRollingWindow] = useState<number>(METRIC_WINDOW.long)
  const [showCorrNumbers, setShowCorrNumbers] = useState(false)
  const [sleeveViewMode, setSleeveViewMode] = useState<'single' | 'all'>('single')
  const [drawdownMode, setDrawdownMode] = useState<DrawdownMode>(() =>
    hasMtmDrawdown ? 'mtm' : 'deal',
  )
  const [pnlScaleMode, setPnlScaleMode] = useState<'linear' | 'log'>('linear')
  const [isSleevePending, startSleeveTransition] = useTransition()
  const pdf = usePdfExport(Boolean(report))
  const pdfPageWidth = pdf.orientation === 'landscape' ? 1120 : 840
  const pdfPageMinHeight = pdf.orientation === 'landscape' ? 794 : 1123
  const analytics = useReportAnalytics({
    report,
    underlyingBySymbol,
    drawdownMode,
    rollingWindow,
    selectedSleeve,
    pdfObfuscate: pdf.obfuscate,
    pdfPageWidth,
    pdfCellSize: PDF_CELL_SIZE,
  })
  const mar = useMarDegradation({
    report,
    baseReport,
    deals,
    baseDeals,
    appliedPct: marDegradationPct,
    underlyingSeries: analytics.underlyingSeries,
    underlyingTimeframes: analytics.underlyingTimeframes,
    drawdownMode,
    setReport,
    setAppliedPct: setMarDegradationPct,
  })
  const performanceColumns = useMemo(() => createPerformanceColumns(theme), [theme])
  const riskColumns = useMemo(() => createRiskColumns(theme), [theme])
  const pnlColor = theme.palette.primary.main
  const axisColor = alpha(theme.palette.text.primary, 0.45)
  const gridColor = alpha(theme.palette.text.primary, 0.12)
  const printPnlColor = PRINT_THEME.palette.primary.main
  const printAxisColor = alpha(PRINT_THEME.palette.text.primary, 0.45)
  const printGridColor = alpha(PRINT_THEME.palette.text.primary, 0.12)

  useEffect(() => {
    const root = document.documentElement
    if (tab === 'sleeves') {
      root.style.setProperty('--main-padding-bottom-xs', '0px')
      root.style.setProperty('--main-padding-bottom-md', '0px')
    } else {
      root.style.removeProperty('--main-padding-bottom-xs')
      root.style.removeProperty('--main-padding-bottom-md')
    }
    return () => {
      root.style.removeProperty('--main-padding-bottom-xs')
      root.style.removeProperty('--main-padding-bottom-md')
    }
  }, [tab])

  if (!report) return null

  const handleRegenerate = () => {
    resetWizard()
    clearUnderlying()
    clearReport()
  }
  const handleSleeveViewModeChange = (value: 'single' | 'all') =>
    startSleeveTransition(() => setSleeveViewMode(value))
  const reportMeta = `Deals: ${report.dealsSourceName?.trim() || 'Unknown file'} • Generated: ${
    report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'Unknown time'
  }`
  const contextValue: ReportViewContextValue = {
    tab,
    report,
    deals,
    performanceRows: analytics.performanceRows,
    gridPerformanceColumns: performanceColumns,
    riskRows: analytics.riskRows,
    gridRiskColumns: riskColumns,
    sleeves: analytics.sleeves,
    selectedContribution: analytics.selectedContribution,
    selectedSleeveMetrics: analytics.selectedSleeveMetrics,
    buildSleeveMetrics: analytics.buildSleeveMetrics,
    sleeveViewMode,
    onSleeveViewModeChange: handleSleeveViewModeChange,
    drawdownMode,
    onDrawdownModeChange: setDrawdownMode,
    hasMtmDrawdown,
    pnlScaleMode,
    onPnlScaleModeChange: setPnlScaleMode,
    rollingWindow,
    onRollingWindowChange: setRollingWindow,
    metricWindow: METRIC_WINDOW,
    baseCapital: analytics.baseCapital,
    pnlColor,
    axisColor,
    gridColor,
    theme,
    isDark,
    getSleeveDrawdown: analytics.getSleeveDrawdown,
    getSleeveDrawdownSource: analytics.getSleeveDrawdownSource,
    allSleevesPlaceholderHeight: ALL_SLEEVES_PLACEHOLDER_HEIGHT,
    portfolioDrawdown: analytics.portfolioDrawdown,
    portfolioDrawdownSource: analytics.portfolioDrawdownSource,
    showCorrNumbers,
    onShowCorrNumbersChange: setShowCorrNumbers,
    correlationMatrix: analytics.correlationMatrix,
    correlationLegend: CORRELATION_LEGEND,
    cellSize: PDF_CELL_SIZE,
    portfolioSummary: analytics.portfolioSummary,
    pdfPerformanceRows: analytics.pdfPerformanceRows,
    pdfRiskRows: analytics.pdfRiskRows,
    pdfPerformanceColumns: PDF_PERFORMANCE_COLUMNS,
    pdfRiskColumns: PDF_RISK_COLUMNS,
    pdfName: pdf.name,
    pdfPageWidth,
    pdfPageMinHeight,
    pdfCorrelationCellSize: analytics.pdfCorrelationCellSize,
    pdfCorrelationLabels: analytics.pdfCorrelationLabels,
    lightTheme: PRINT_THEME,
    printPnlColor,
    printAxisColor,
    printGridColor,
    formatPdfSleeveLabel: analytics.formatPdfSleeveLabel,
    formatPdfSymbol: analytics.formatPdfSymbol,
    onSelectSleeve: setSelectedSleeve,
    underlyingTimeframes: analytics.underlyingTimeframes,
    underlyingSeries: analytics.underlyingSeries,
  }

  return (
    <ReportViewProvider value={contextValue}>
      <Stack
        spacing={2}
        sx={{
          mt: 1,
          '--main-padding-bottom-xs': tab === 'sleeves' ? '0px' : '24px',
          '--main-padding-bottom-md': tab === 'sleeves' ? '0px' : '32px',
        }}
      >
        <ReportHeader
          tab={tab}
          reportMeta={reportMeta}
          marDegradationPct={marDegradationPct}
          isPdfGenerating={pdf.isGenerating}
          isMarApplying={mar.isApplying}
          canApplyMarDegradation={mar.canApply}
          onTabChange={setTab}
          onOpenPdf={pdf.openDialog}
          onRegenerate={handleRegenerate}
          onOpenMarDegradation={mar.openDialog}
          onRemoveMarDegradation={mar.remove}
        />
        <PdfSettingsDialog
          open={pdf.dialogOpen}
          name={pdf.name}
          orientation={pdf.orientation}
          obfuscate={pdf.obfuscate}
          onClose={pdf.closeDialog}
          onNameChange={pdf.setName}
          onOrientationChange={pdf.setOrientation}
          onObfuscateChange={pdf.setObfuscate}
          onGenerate={pdf.generate}
        />
        <MarDegradationDialog
          open={mar.dialogOpen}
          value={mar.input}
          canApply={mar.canApply}
          isApplying={mar.isApplying}
          onClose={mar.closeDialog}
          onValueChange={mar.setInput}
          onApply={mar.apply}
        />
        <ReportTabsContent />
        <ReportPdfRenderer
          visible={pdf.shouldRender}
          theme={PRINT_THEME}
          width={pdfPageWidth}
          containerRef={pdf.containerRef}
        />
        <ReportBusyOverlays
          sleevePending={isSleevePending}
          pdfGenerating={pdf.isGenerating}
          marApplying={mar.isApplying}
        />
      </Stack>
    </ReportViewProvider>
  )
}

export default ReportView
