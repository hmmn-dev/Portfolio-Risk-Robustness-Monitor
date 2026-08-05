import type { GridColDef } from '@mui/x-data-grid'
import { createContext, useContext } from 'react'
import type { DealRow, ReportModel, UnderlyingSeries } from '../../../engine/types'
import type { ReportTab } from '../types'
import type { CorrelationMatrix, PerformanceRow, PortfolioSummary, RiskRow } from '../types'
import type { AppliedPortfolioComposition } from '../hooks/usePortfolioComposition'
import type { PdfColumn } from './PdfTable'
import type { SleeveMetrics } from './SleeveSection'

type SharedChartState = {
  drawdownMode: 'deal' | 'mtm'
  onDrawdownModeChange: (value: 'deal' | 'mtm') => void
  hasMtmDrawdown: boolean
  pnlScaleMode: 'linear' | 'log'
  onPnlScaleModeChange: (value: 'linear' | 'log') => void
  baseCapital: number
}

export type ReportNavigationContextValue = {
  tab: ReportTab
}

export type ReportTablesContextValue = {
  performanceRows: PerformanceRow[]
  gridPerformanceColumns: GridColDef[]
  riskRows: RiskRow[]
  gridRiskColumns: GridColDef[]
}

export type ReportSleevesContextValue = SharedChartState & {
  report: ReportModel
  sleeves: string[]
  selectedContribution: ReportModel['contributions'][number] | null
  selectedSleeveMetrics: SleeveMetrics | null
  buildSleeveMetrics: (item: ReportModel['contributions'][number]) => SleeveMetrics | null
  sleeveViewMode: 'single' | 'all'
  onSleeveViewModeChange: (value: 'single' | 'all') => void
  rollingWindow: number
  onRollingWindowChange: (value: number) => void
  metricWindow: { short: number; long: number }
  getSleeveDrawdown: (
    item: ReportModel['contributions'][number],
  ) => ReportModel['contributions'][number]['drawdown']
  getSleeveDrawdownSource: (
    item: ReportModel['contributions'][number],
  ) => ReportModel['contributions'][number]['drawdownSource']
  allSleevesPlaceholderHeight: number
  onSelectSleeve: (sleeve: string) => void
}

export type ReportPortfolioContextValue = SharedChartState & {
  report: ReportModel
  deals: DealRow[] | null
  appliedComposition: AppliedPortfolioComposition | null
  onApplyComposition: (composition: AppliedPortfolioComposition) => void
  onResetComposition: () => void
  portfolioDrawdown: ReportModel['portfolio']['drawdown']
  portfolioDrawdownFallback: ReportModel['portfolio']['drawdown']
  portfolioDrawdownSource?: ReportModel['portfolio']['drawdownSource']
  showCorrNumbers: boolean
  onShowCorrNumbersChange: (value: boolean) => void
  correlationMatrix: CorrelationMatrix
  correlationLegend: string
  cellSize: number
  portfolioSummary: PortfolioSummary | null
  riskRows: RiskRow[]
  underlyingTimeframes: Record<string, 'H1' | 'D1'>
  underlyingSeries: UnderlyingSeries[]
}

export type ReportPdfContextValue = {
  report: ReportModel
  riskRows: RiskRow[]
  baseCapital: number
  portfolioDrawdown: ReportModel['portfolio']['drawdown']
  portfolioDrawdownFallback: ReportModel['portfolio']['drawdown']
  portfolioDrawdownSource?: ReportModel['portfolio']['drawdownSource']
  drawdownMode: 'deal' | 'mtm'
  pnlScaleMode: 'linear' | 'log'
  correlationMatrix: CorrelationMatrix
  correlationLegend: string
  showCorrNumbers: boolean
  portfolioSummary: PortfolioSummary | null
  buildSleeveMetrics: (item: ReportModel['contributions'][number]) => SleeveMetrics | null
  getSleeveDrawdown: (
    item: ReportModel['contributions'][number],
  ) => ReportModel['contributions'][number]['drawdown']
  getSleeveDrawdownSource: (
    item: ReportModel['contributions'][number],
  ) => ReportModel['contributions'][number]['drawdownSource']
  pdfPerformanceRows: PerformanceRow[]
  pdfRiskRows: RiskRow[]
  pdfPerformanceColumns: PdfColumn<PerformanceRow>[]
  pdfRiskColumns: PdfColumn<RiskRow>[]
  pdfName: string
  pdfPageWidth: number
  pdfPageMinHeight: number
  pdfCorrelationCellSize: number
  pdfCorrelationLabels: string[]
  formatPdfSleeveLabel: (label: string) => string
  formatPdfSymbol: (symbol: string) => string
}

export type ReportViewContextValues = {
  navigation: ReportNavigationContextValue
  tables: ReportTablesContextValue
  sleeves: ReportSleevesContextValue
  portfolio: ReportPortfolioContextValue
  pdf: ReportPdfContextValue
}

export const ReportNavigationContext = createContext<ReportNavigationContextValue | null>(null)
export const ReportTablesContext = createContext<ReportTablesContextValue | null>(null)
export const ReportSleevesContext = createContext<ReportSleevesContextValue | null>(null)
export const ReportPortfolioContext = createContext<ReportPortfolioContextValue | null>(null)
export const ReportPdfContext = createContext<ReportPdfContextValue | null>(null)

const useRequiredContext = <Value>(value: Value | null, name: string) => {
  if (!value) throw new Error(`${name} must be used within ReportViewProvider`)
  return value
}

export const useReportNavigation = () =>
  useRequiredContext(useContext(ReportNavigationContext), 'useReportNavigation')

export const useReportTables = () =>
  useRequiredContext(useContext(ReportTablesContext), 'useReportTables')

export const useReportSleeves = () =>
  useRequiredContext(useContext(ReportSleevesContext), 'useReportSleeves')

export const useReportPortfolio = () =>
  useRequiredContext(useContext(ReportPortfolioContext), 'useReportPortfolio')

export const useReportPdf = () => useRequiredContext(useContext(ReportPdfContext), 'useReportPdf')
