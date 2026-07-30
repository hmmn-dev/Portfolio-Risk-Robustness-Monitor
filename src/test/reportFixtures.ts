import { createTheme } from '@mui/material/styles'
import type { ReportModel } from '../engine/types'
import type { ReportViewContextValue } from '../ui/report-view/components/ReportViewContext'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

const alphaContribution: ReportModel['contributions'][number] = {
  key: 'Alpha::EURUSD',
  sleeve: 'Alpha - EURUSD',
  symbol: 'EURUSD',
  pnl: [
    { time: day(0), value: 100 },
    { time: day(1), value: -25 },
  ],
  returns: [
    { time: day(0), value: Number.NaN },
    { time: day(1), value: -0.0025 },
  ],
  index: [
    { time: day(0), value: 1 },
    { time: day(1), value: 0.9975 },
  ],
  drawdown: [
    { time: day(0), value: 0 },
    { time: day(1), value: -0.25 },
  ],
  drawdownSource: 'D1',
  baseCapital: 10000,
}

const betaContribution: ReportModel['contributions'][number] = {
  key: 'Beta::USDJPY',
  sleeve: 'Beta - USDJPY',
  symbol: 'USDJPY',
  pnl: [
    { time: day(0), value: 0 },
    { time: day(1), value: -25 },
  ],
  returns: [
    { time: day(0), value: Number.NaN },
    { time: day(1), value: -0.0025 },
  ],
  index: [
    { time: day(0), value: 1 },
    { time: day(1), value: 0.9975 },
  ],
  drawdown: [
    { time: day(0), value: 0 },
    { time: day(1), value: -0.25 },
  ],
  drawdownSource: 'D1',
}

export const createReport = (): ReportModel => ({
  generatedAt: day(2),
  dealsSourceName: 'deals.csv',
  portfolio: {
    days: [
      {
        time: day(0),
        pnl: 100,
        equity: 10100,
        denom: Number.NaN,
        return: Number.NaN,
      },
      {
        time: day(1),
        pnl: -50,
        equity: 10050,
        denom: 10100,
        return: -50 / 10100,
      },
    ],
    index: [
      { time: day(0), value: 1 },
      { time: day(1), value: 10050 / 10100 },
    ],
    drawdown: [
      { time: day(0), value: 0 },
      { time: day(1), value: (10050 / 10100 - 1) * 100 },
    ],
    drawdownSource: 'D1',
  },
  contributions: [alphaContribution, betaContribution],
})

const noop = () => undefined
const theme = createTheme()

export const createReportContext = (
  overrides: Partial<ReportViewContextValue> = {},
): ReportViewContextValue => {
  const report = overrides.report ?? createReport()
  const selectedContribution = overrides.selectedContribution ?? report.contributions[0]
  const metrics = {
    alphaSeries: [{ time: day(1), value: 1.2 }],
    alphaBounds: { min: -1, max: 2 },
    sharpeSeries: [{ time: day(1), value: 0.8 }],
    sharpeBounds: { min: -1, max: 1 },
    winrateSeries: [{ time: day(1), value: 0.6 }],
  }

  return {
    tab: 'performance',
    report,
    deals: null,
    performanceRows: [
      {
        id: 1,
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        totalPnl: 75,
        meanAnn: 1.5,
        sharpe: 0.8,
        last2yPnl: 75,
        last2yMeanAnn: 1.5,
        last2ySharpe: 0.8,
      },
    ],
    gridPerformanceColumns: [
      { field: 'sleeve', headerName: 'Sleeve' },
      { field: 'symbol', headerName: 'Symbol' },
    ],
    riskRows: [
      {
        id: 1,
        sleeve: 'Alpha',
        symbol: 'EURUSD',
        status: 'GREEN',
        shock: 'NONE',
        alphaPct: 80,
        winratePctile: 70,
        last1ySharpe: 0.7,
        last2ySharpe: 0.8,
        overallSharpe: 0.75,
        last2yWinrate: 0.6,
        statusReasons: 'Strong signal',
        statusAction: 'Monitor',
      },
    ],
    gridRiskColumns: [
      { field: 'sleeve', headerName: 'Sleeve' },
      { field: 'status', headerName: 'Status' },
    ],
    sleeves: report.contributions.map((item) => item.sleeve),
    selectedContribution,
    selectedSleeveMetrics: metrics,
    buildSleeveMetrics: () => metrics,
    sleeveViewMode: 'single',
    onSleeveViewModeChange: noop,
    drawdownMode: 'deal',
    onDrawdownModeChange: noop,
    hasMtmDrawdown: false,
    pnlScaleMode: 'linear',
    onPnlScaleModeChange: noop,
    rollingWindow: 504,
    onRollingWindowChange: noop,
    metricWindow: { short: 252, long: 504 },
    baseCapital: 10000,
    pnlColor: '#1976d2',
    axisColor: '#555555',
    gridColor: '#dddddd',
    theme,
    isDark: false,
    getSleeveDrawdown: (item) => item.drawdown,
    getSleeveDrawdownSource: (item) => item.drawdownSource,
    allSleevesPlaceholderHeight: 400,
    portfolioDrawdown: report.portfolio.drawdown,
    portfolioDrawdownSource: report.portfolio.drawdownSource,
    showCorrNumbers: true,
    onShowCorrNumbersChange: noop,
    correlationMatrix: {
      labels: report.contributions.map((item) => item.sleeve),
      values: [
        [1, 0.25],
        [0.25, 1],
      ],
    },
    correlationLegend: 'linear-gradient(red, green)',
    cellSize: 28,
    portfolioSummary: {
      totalReturnPct: -0.5,
      cagr: -1,
      maxDrawdown: -0.5,
      mar: -2,
      sharpe: -0.3,
      regression: {
        n: 20,
        alphaAnn: 1.2,
        betas: [{ symbol: 'EURUSD', beta: 0.7 }],
        r2: 0.6,
      },
    },
    pdfPerformanceRows: [],
    pdfRiskRows: [],
    pdfPerformanceColumns: [],
    pdfRiskColumns: [],
    pdfName: 'Test Portfolio',
    pdfPageWidth: 1120,
    pdfPageMinHeight: 794,
    pdfCorrelationCellSize: 28,
    pdfCorrelationLabels: ['Sleeve 1', 'Sleeve 2'],
    lightTheme: theme,
    printPnlColor: '#1976d2',
    printAxisColor: '#555555',
    printGridColor: '#dddddd',
    formatPdfSleeveLabel: (label) => `PDF ${label}`,
    formatPdfSymbol: (symbol) => `PDF ${symbol}`,
    onSelectSleeve: noop,
    underlyingTimeframes: {},
    underlyingSeries: [],
    ...overrides,
  }
}
