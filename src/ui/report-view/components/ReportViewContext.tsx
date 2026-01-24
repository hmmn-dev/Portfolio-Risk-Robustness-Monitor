import type { Theme } from '@mui/material/styles'
import type { GridColDef } from '@mui/x-data-grid'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { DealRow, ReportModel, UnderlyingSeries } from '../../../engine/types'
import type { SleeveMetrics } from './SleeveSection'
import type { CorrelationMatrix, PerformanceRow, PortfolioSummary, RiskRow } from '../types'
import type { PdfColumn } from './PdfTable'

export type ReportViewContextValue = {
  tab: 'performance' | 'risk' | 'sleeves' | 'portfolio'
  report: ReportModel
  deals: DealRow[] | null
  performanceRows: PerformanceRow[]
  gridPerformanceColumns: GridColDef[]
  riskRows: RiskRow[]
  gridRiskColumns: GridColDef[]
  sleeves: string[]
  selectedContribution: ReportModel['contributions'][number] | null
  selectedSleeveMetrics: SleeveMetrics | null
  buildSleeveMetrics: (item: ReportModel['contributions'][number]) => SleeveMetrics | null
  sleeveViewMode: 'single' | 'all'
  onSleeveViewModeChange: (value: 'single' | 'all') => void
  drawdownMode: 'deal' | 'mtm'
  onDrawdownModeChange: (value: 'deal' | 'mtm') => void
  hasMtmDrawdown: boolean
  pnlScaleMode: 'linear' | 'log'
  onPnlScaleModeChange: (value: 'linear' | 'log') => void
  rollingWindow: number
  onRollingWindowChange: (value: number) => void
  metricWindow: { short: number; long: number }
  baseCapital: number
  pnlColor: string
  axisColor: string
  gridColor: string
  theme: Theme
  isDark: boolean
  getSleeveDrawdown: (item: ReportModel['contributions'][number]) => ReportModel['contributions'][number]['drawdown']
  getSleeveDrawdownSource: (
    item: ReportModel['contributions'][number]
  ) => ReportModel['contributions'][number]['drawdownSource']
  allSleevesPlaceholderHeight: number
  portfolioDrawdown: ReportModel['portfolio']['drawdown']
  portfolioDrawdownSource?: ReportModel['portfolio']['drawdownSource']
  showCorrNumbers: boolean
  onShowCorrNumbersChange: (value: boolean) => void
  correlationMatrix: CorrelationMatrix
  correlationLegend: string
  cellSize: number
  portfolioSummary: PortfolioSummary | null
  pdfPerformanceRows: PerformanceRow[]
  pdfRiskRows: RiskRow[]
  pdfPerformanceColumns: PdfColumn<PerformanceRow>[]
  pdfRiskColumns: PdfColumn<RiskRow>[]
  pdfName: string
  pdfPageWidth: number
  pdfPageMinHeight: number
  pdfCorrelationCellSize: number
  pdfCorrelationLabels: string[]
  lightTheme: Theme
  printPnlColor: string
  printAxisColor: string
  printGridColor: string
  formatPdfSleeveLabel: (label: string) => string
  formatPdfSymbol: (symbol: string) => string
  onSelectSleeve: (sleeve: string) => void
  underlyingTimeframes: Record<string, 'H1' | 'D1'>
  underlyingSeries: UnderlyingSeries[]
}

const ReportViewContext = createContext<ReportViewContextValue | null>(null)

export const ReportViewProvider = ({
  value,
  children,
}: {
  value: ReportViewContextValue
  children: ReactNode
}) => <ReportViewContext.Provider value={value}>{children}</ReportViewContext.Provider>

export const useReportViewContext = () => {
  const context = useContext(ReportViewContext)
  if (!context) {
    throw new Error('useReportViewContext must be used within ReportViewProvider')
  }
  return context
}
