import {
  Box,
  Backdrop,
  Button,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Tab,
  Tabs,
  Typography,
  ThemeProvider,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { GridColDef } from '@mui/x-data-grid'
import type { SyntheticEvent } from 'react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined'
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined'
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import { correlation } from '../../engine/correlation'
import { computeDdShock } from '../../engine/ddShock'
import { rollingOlsPairs, rollingSharpe, rollingWinrate } from '../../engine/statsRolling'
import { computeAlphaPercentiles, computeStatus } from '../../engine/status'
import { stableSort } from '../../engine/stableSort'
import type { ReportModel, UnderlyingDailyReturn } from '../../engine/types'
import { useReportStore } from '../../store/report'
import { useUnderlyingStore } from '../../store/underlying'
import { useWizardStore } from '../../store/wizard'
import { createAppTheme } from '../../theme'
import { getSymbolChipStyles, heatmapPalette } from './colors'
import type { PdfColumn } from './components/PdfTable'
import ReportPdf from './components/ReportPdf'
import ReportTabsContent from './components/ReportTabsContent'
import type { SleeveMetrics } from './components/SleeveSection'
import { ReportViewProvider } from './components/ReportViewContext'
import {
  alignPairsByDay,
  buildObfuscationMap,
  buildReturnMap,
  buildSleeveKey,
  computeMean,
  computeSeriesBounds,
  computeSharpe,
  getLastFinite,
  getSeriesValues,
  normalizeSymbol,
  portfolioRegression,
  resolveBaseCapital,
  sanitizeSeries,
  splitSleeveLabel,
  sumFinite,
} from './helpers'
import { formatCurrency, formatNumber, formatPercent, formatRate } from './formatters'
import type { CorrelationMatrix, PerformanceRow, PortfolioSummary, RiskRow } from './types'

type TabValue = 'performance' | 'risk' | 'sleeves' | 'portfolio'


const metricWindow = {
  short: 252,
  long: 504,
}

const ALL_SLEEVES_PLACEHOLDER_HEIGHT = 720

const computeSleeveMetrics = (
  item: ReportModel['contributions'][number],
  portfolioReturnMap: Map<number, number>,
  window: number,
  underlying: UnderlyingDailyReturn[] | null
): SleeveMetrics => {
  const returns = sanitizeSeries(getSeriesValues(item.returns))
  const minObs = Math.floor(window * 0.8)
  const minActive = Math.floor(window * 0.2)
  const hasUnderlying = !!underlying && underlying.length > 0
  const returnsMap = hasUnderlying ? buildReturnMap(underlying) : null
  const alignedPrimary = alignPairsByDay(item.returns, returnsMap ?? portfolioReturnMap)
  const alignedFallback = alignPairsByDay(item.returns, portfolioReturnMap)
  const useFallback = !hasUnderlying || (returnsMap && alignedPrimary.validCount < minObs)
  const aligned = useFallback ? alignedFallback : alignedPrimary
  const alphaValues = rollingOlsPairs(aligned.xs, aligned.ys, window, {
    minObs,
    minActive,
  }).alpha
  const alphaTimes = aligned.times
  const alphaSeries = alphaValues.map((value, idx) => ({
    time: alphaTimes[idx] ?? idx,
    value: Number.isFinite(value) ? value * 252 * 100 : value,
  }))
  const alphaBounds = computeSeriesBounds(alphaSeries.map((point) => point.value), 0.15, 0.01)
  const sharpeSeries = rollingSharpe(returns, window).map((value, idx) => ({
    time: item.returns[idx]?.time ?? idx,
    value,
  }))
  const sharpeBounds = computeSeriesBounds(sharpeSeries.map((point) => point.value), 0.2, 0.05)
  const winrateSeries = rollingWinrate(returns, window).map((value, idx) => ({
    time: item.returns[idx]?.time ?? idx,
    value: Math.min(1, Math.max(0, value)),
  }))

  return {
    alphaSeries,
    alphaBounds,
    sharpeSeries,
    sharpeBounds,
    winrateSeries,
  }
}

const ReportView = () => {
  const report = useReportStore((state) => state.report)
  const baseReport = useReportStore((state) => state.baseReport)
  const clearReport = useReportStore((state) => state.clearReport)
  const setReport = useReportStore((state) => state.setReport)
  const deals = useReportStore((state) => state.deals)
  const baseDeals = useReportStore((state) => state.baseDeals)
  const marDegradationPct = useReportStore((state) => state.marDegradationPct)
  const setMarDegradationPct = useReportStore((state) => state.setMarDegradationPct)
  const resetWizard = useWizardStore((state) => state.resetWizard)
  const underlyingBySymbol = useUnderlyingStore((state) => state.seriesBySymbol)
  const clearUnderlying = useUnderlyingStore((state) => state.clearUnderlying)
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const pnlColor = theme.palette.primary.main
  const axisColor = alpha(theme.palette.text.primary, 0.45)
  const gridColor = alpha(theme.palette.text.primary, 0.12)
  const negativeColor = isDark ? theme.palette.error.light : theme.palette.error.dark
  const [tab, setTab] = useState<TabValue>('performance')
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null)
  const [rollingWindow, setRollingWindow] = useState(metricWindow.long)
  const [showCorrNumbers, setShowCorrNumbers] = useState(false)
  const [sleeveViewMode, setSleeveViewMode] = useState<'single' | 'all'>('single')
  const [drawdownMode, setDrawdownMode] = useState<'deal' | 'mtm'>('deal')
  const [pnlScaleMode, setPnlScaleMode] = useState<'linear' | 'log'>('linear')
  const [isSleevePending, startSleeveTransition] = useTransition()
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfName, setPdfName] = useState('Portfolio Monitoring Report')
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [pdfObfuscate, setPdfObfuscate] = useState(true)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const [renderPdf, setRenderPdf] = useState(false)
  const [marDialogOpen, setMarDialogOpen] = useState(false)
  const [marDegradeInput, setMarDegradeInput] = useState('10')
  const [isMarApplying, setIsMarApplying] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const marWorkerRef = useRef<Worker | null>(null)
  const marRequestIdRef = useRef(0)
  const lightTheme = useMemo(() => createAppTheme('light'), [])
  const correlationLegend = useMemo(
    () =>
      `linear-gradient(90deg, ${heatmapPalette
        .map((color, idx) => `${color} ${(idx / (heatmapPalette.length - 1)) * 100}%`)
        .join(', ')})`,
    []
  )
  const cellSize = 28
  const pdfPageWidth = pdfOrientation === 'landscape' ? 1120 : 840
  const pdfPageMinHeight = pdfOrientation === 'landscape' ? 794 : 1123
  const printAxisColor = alpha(lightTheme.palette.text.primary, 0.45)
  const printGridColor = alpha(lightTheme.palette.text.primary, 0.12)
  const printPnlColor = lightTheme.palette.primary.main
  const portfolioReturnMap = useMemo(
    () => buildReturnMap(report?.portfolio.days ?? []),
    [report]
  )
  const baseCapital = useMemo(
    () => resolveBaseCapital(report?.portfolio.days ?? [], 10000),
    [report]
  )
  const hasMtmDrawdown = !!report?.portfolio.drawdownMtm?.length
  useEffect(() => {
    if (!report) return
    setDrawdownMode(hasMtmDrawdown ? 'mtm' : 'deal')
  }, [report, hasMtmDrawdown])
  const portfolioDrawdown =
    drawdownMode === 'mtm' && report?.portfolio.drawdownMtm?.length
      ? report.portfolio.drawdownMtm
      : report?.portfolio.drawdown ?? []
  const portfolioDrawdownSource =
    drawdownMode === 'mtm' && report?.portfolio.drawdownMtmSource
      ? report.portfolio.drawdownMtmSource
      : report?.portfolio.drawdownSource

  const getSleeveDrawdown = (item: ReportModel['contributions'][number] | null) => {
    if (!item) return []
    if (drawdownMode === 'mtm' && item.drawdownMtm?.length) {
      return item.drawdownMtm
    }
    return item.drawdown ?? []
  }

  const getSleeveDrawdownSource = (item: ReportModel['contributions'][number] | null) => {
    if (!item) return undefined
    if (drawdownMode === 'mtm' && item.drawdownMtmSource) {
      return item.drawdownMtmSource
    }
    return item.drawdownSource
  }

  const buildSleeveMetrics = (item: ReportModel['contributions'][number]) =>
    report
      ? computeSleeveMetrics(
          item,
          portfolioReturnMap,
          rollingWindow,
          getUnderlyingForSymbol(item.symbol, item.sleeve)
        )
      : null

  const handleSleeveViewModeChange = (value: 'single' | 'all') =>
    startSleeveTransition(() => setSleeveViewMode(value))

  const handleDrawdownModeChange = (value: 'deal' | 'mtm') => setDrawdownMode(value)

  const handlePnlScaleModeChange = (value: 'linear' | 'log') => setPnlScaleMode(value)

  const handleRollingWindowChange = (value: number) => setRollingWindow(value)

  const handleSelectSleeve = (sleeve: string) => setSelectedSleeve(sleeve)

  const handleShowCorrNumbersChange = (value: boolean) => setShowCorrNumbers(value)
  const isMenuOpen = Boolean(menuAnchorEl)
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
  }
  const handleMenuClose = () => setMenuAnchorEl(null)

  const normalizedUnderlying = useMemo(() => {
    const map: Record<string, UnderlyingDailyReturn[]> = {}
    Object.entries(underlyingBySymbol).forEach(([key, value]) => {
      const normalized = normalizeSymbol(key)
      if (!map[normalized]) {
        map[normalized] = value.daily
      }
    })
    return map
  }, [underlyingBySymbol])

  const underlyingSeries = useMemo(
    () => Object.values(underlyingBySymbol),
    [underlyingBySymbol]
  )

  const underlyingTimeframes = useMemo(() => {
    const map: Record<string, 'H1' | 'D1'> = {}
    Object.entries(underlyingBySymbol).forEach(([symbol, series]) => {
      map[symbol] = series.timeframe
    })
    return map
  }, [underlyingBySymbol])

  const getUnderlyingForSymbol = (symbol: string, sleeveLabel: string) => {
    const base = symbol || splitSleeveLabel(sleeveLabel).symbol
    if (!base) return null
    const key = normalizeSymbol(base)
    return normalizedUnderlying[key] ?? null
  }

  const portfolioSummary = useMemo<PortfolioSummary | null>(() => {
    if (!report) return null
    const returns = report.portfolio.days.map((day) => day.return)
    const totalReturnPct =
      report.portfolio.index.length > 0
        ? (report.portfolio.index[report.portfolio.index.length - 1].value - 1) * 100
        : Number.NaN
    const startIndex = report.portfolio.index[0]?.value ?? Number.NaN
    const endIndex =
      report.portfolio.index.length > 0
        ? report.portfolio.index[report.portfolio.index.length - 1].value
        : Number.NaN
    const startTime = report.portfolio.index[0]?.time ?? Number.NaN
    const endTime =
      report.portfolio.index.length > 0
        ? report.portfolio.index[report.portfolio.index.length - 1].time
        : Number.NaN
    const years =
      Number.isFinite(startTime) && Number.isFinite(endTime)
        ? (endTime - startTime) / (365.25 * 24 * 60 * 60 * 1000)
        : Number.NaN
    const cagr =
      Number.isFinite(startIndex) &&
      Number.isFinite(endIndex) &&
      startIndex > 0 &&
      endIndex > 0 &&
      Number.isFinite(years) &&
      years > 0
        ? (Math.pow(endIndex / startIndex, 1 / years) - 1) * 100
        : Number.NaN
    const maxDrawdown = portfolioDrawdown.reduce(
      (min, point) => (point.value < min ? point.value : min),
      0
    )
    const mar = maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : Number.NaN
    const sharpe = computeSharpe(returns)
    const regression = portfolioRegression(
      report.portfolio.days,
      Array.from(
        new Set(
          report.contributions
            .map((item) => normalizeSymbol(item.symbol))
            .filter((value) => value.length > 0)
        )
      ),
      normalizedUnderlying
    )
    return {
      totalReturnPct,
      cagr,
      maxDrawdown,
      mar,
      sharpe,
      regression,
    }
  }, [report, normalizedUnderlying, portfolioDrawdown])

  const pdfObfuscation = useMemo(() => {
    if (!report) return null
    const sleeveKeys = report.contributions.map((item) => {
      const sleeveParts = splitSleeveLabel(item.sleeve)
      const symbol = sleeveParts.symbol || item.symbol
      return buildSleeveKey(sleeveParts.sleeve, symbol)
    })
    const symbols = report.contributions.map((item) => {
      const sleeveParts = splitSleeveLabel(item.sleeve)
      return sleeveParts.symbol || item.symbol
    })
    if (portfolioSummary?.regression?.betas) {
      portfolioSummary.regression.betas.forEach((item) => symbols.push(item.symbol))
    }
    const sleeveMap = buildObfuscationMap(sleeveKeys, 'SLEEVE')
    const symbolMap = buildObfuscationMap(symbols, 'SYM')
    const formatSleeve = (value: string, symbol: string) =>
      sleeveMap.get(buildSleeveKey(value, symbol)) ?? value
    const formatSymbol = (value: string) => symbolMap.get(value) ?? value
    const formatSleeveLabel = (label: string) => {
      const parts = splitSleeveLabel(label)
      const obfuscatedSleeve = formatSleeve(parts.sleeve, parts.symbol)
      if (!parts.symbol) return obfuscatedSleeve
      return `${obfuscatedSleeve} - ${formatSymbol(parts.symbol)}`
    }
    return { formatSleeve, formatSymbol, formatSleeveLabel }
  }, [report, portfolioSummary])

  const formatPdfSymbol = (value: string) =>
    pdfObfuscate && pdfObfuscation ? pdfObfuscation.formatSymbol(value) : value
  const formatPdfSleeveLabel = (value: string) =>
    pdfObfuscate && pdfObfuscation ? pdfObfuscation.formatSleeveLabel(value) : value

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

  useEffect(() => {
    const worker = new Worker(new URL('./workers/marWorker.ts', import.meta.url), {
      type: 'module',
    })
    marWorkerRef.current = worker
    return () => {
      worker.terminate()
      marWorkerRef.current = null
    }
  }, [])


  const handlePrintReport = () => {
    setPdfDialogOpen(true)
  }

  const applyMarDegradation = (targetPct: number) => {
    if (!report) return Promise.resolve()
    const sourceDeals = baseDeals ?? deals
    if (!sourceDeals || sourceDeals.length === 0) return Promise.resolve()
    const worker = marWorkerRef.current
    if (!worker) return Promise.resolve()
    const payload = {
      requestId: marRequestIdRef.current + 1,
      deals: sourceDeals,
      underlyingSeries,
      underlyingTimeframes,
      drawdownMode,
      targetPct,
      dealsSourceName: baseReport?.dealsSourceName ?? report.dealsSourceName,
    }
    marRequestIdRef.current = payload.requestId

    return new Promise<void>((resolve, reject) => {
      const handleMessage = (
        event: MessageEvent<{ requestId: number; report: ReportModel; appliedPct: number | null }>
      ) => {
        if (event.data.requestId !== payload.requestId) return
        worker.removeEventListener('message', handleMessage)
        worker.removeEventListener('error', handleError)
        setReport(event.data.report)
        setMarDegradationPct(event.data.appliedPct)
        resolve()
      }
      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener('message', handleMessage)
        worker.removeEventListener('error', handleError)
        reject(event.error)
      }
      worker.addEventListener('message', handleMessage)
      worker.addEventListener('error', handleError)
      worker.postMessage(payload)
    })
  }

  const handleApplyMarDegradation = () => {
    const sourceDeals = baseDeals ?? deals
    if (!report || !sourceDeals || sourceDeals.length === 0) return
    const targetPctRaw = Number(marDegradeInput)
    if (!Number.isFinite(targetPctRaw)) return
    const targetPct = Math.max(0, Math.min(100, targetPctRaw))
    if (marDegradationPct != null && Math.abs(marDegradationPct - targetPct) < 1e-6) {
      setMarDialogOpen(false)
      return
    }
    setMarDialogOpen(false)
    setIsMarApplying(true)
    void (async () => {
      try {
        await applyMarDegradation(targetPct)
      } finally {
        setIsMarApplying(false)
      }
    })()
  }

  const handleRemoveMarDegradation = () => {
    const sourceDeals = baseDeals ?? deals
    if (!report || !sourceDeals || sourceDeals.length === 0) return
    setIsMarApplying(true)
    void (async () => {
      try {
        if (baseReport) {
          setReport(baseReport)
          setMarDegradationPct(null)
        } else {
          await applyMarDegradation(0)
        }
      } finally {
        setIsMarApplying(false)
      }
    })()
  }

  const pdfPerformanceColumns = useMemo<PdfColumn<PerformanceRow>[]>(
    () => [
      { header: 'Sleeve', getCell: (row) => ({ text: row.sleeve }) },
      { header: 'Symbol', getCell: (row) => ({ text: row.symbol || '-' }) },
      {
        header: 'Total PnL',
        getCell: (row) => ({
          text: formatCurrency(row.totalPnl),
          negative: row.totalPnl < 0,
          align: 'right',
        }),
      },
      {
        header: 'Mean ann %',
        getCell: (row) => ({
          text: formatPercent(row.meanAnn, 2),
          negative: row.meanAnn < 0,
          align: 'right',
        }),
      },
      {
        header: 'Sharpe',
        getCell: (row) => ({
          text: formatNumber(row.sharpe, 2),
          negative: row.sharpe < 0,
          align: 'right',
        }),
      },
      {
        header: 'Last 2Y PnL',
        getCell: (row) => ({
          text: formatCurrency(row.last2yPnl),
          negative: row.last2yPnl < 0,
          align: 'right',
        }),
      },
      {
        header: 'Last 2Y Mean ann %',
        getCell: (row) => ({
          text: formatPercent(row.last2yMeanAnn, 2),
          negative: row.last2yMeanAnn < 0,
          align: 'right',
        }),
      },
      {
        header: 'Last 2Y Sharpe',
        getCell: (row) => ({
          text: formatNumber(row.last2ySharpe, 2),
          negative: row.last2ySharpe < 0,
          align: 'right',
        }),
      },
    ],
    []
  )

  const pdfRiskColumns = useMemo<PdfColumn<RiskRow>[]>(
    () => [
      { header: 'Sleeve', getCell: (row) => ({ text: row.sleeve }) },
      { header: 'Symbol', getCell: (row) => ({ text: row.symbol || '-' }) },
      { header: 'Status', getCell: (row) => ({ text: row.status || '-' }) },
      { header: 'Shock', getCell: (row) => ({ text: row.shock || '-' }) },
      {
        header: 'Alpha pctile',
        getCell: (row) => ({
          text: formatPercent(row.alphaPct, 0),
          negative: (row.alphaPct ?? 0) < 0,
          align: 'right',
        }),
      },
      {
        header: 'Last 1Y Sharpe',
        getCell: (row) => ({
          text: formatNumber(row.last1ySharpe, 2),
          negative: (row.last1ySharpe ?? 0) < 0,
          align: 'right',
        }),
      },
      {
        header: 'Last 2Y Sharpe',
        getCell: (row) => ({
          text: formatNumber(row.last2ySharpe, 2),
          negative: (row.last2ySharpe ?? 0) < 0,
          align: 'right',
        }),
      },
      {
        header: 'Last 2Y Winrate',
        getCell: (row) => ({
          text: formatRate(row.last2yWinrate, 1),
          align: 'right',
        }),
      },
    ],
    []
  )

  const handleGeneratePdf = async () => {
    if (!report) return
    setPdfDialogOpen(false)
    setIsPdfGenerating(true)
    setRenderPdf(true)
    try {
      const waitForFrame = () =>
        new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve())
        })
      await waitForFrame()
      await waitForFrame()
      const container = pdfContainerRef.current
      if (!container) return
      const pages = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page]'))
      const doc = new jsPDF({
        orientation: pdfOrientation,
        unit: 'pt',
        format: 'a4',
      })
      for (let index = 0; index < pages.length; index += 1) {
        await waitForFrame()
        const page = pages[index]
        const canvas = await html2canvas(page, {
          backgroundColor: '#ffffff',
          scale: 2.2,
          useCORS: true,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
        const imgWidth = canvas.width * ratio
        const imgHeight = canvas.height * ratio
        const x = (pageWidth - imgWidth) / 2
        const y = (pageHeight - imgHeight) / 2
        if (index > 0) doc.addPage()
        doc.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight, undefined, 'FAST')
        await waitForFrame()
      }
      const safeName = pdfName.trim()
        ? pdfName.trim().replace(/[\\/:*?"<>|]+/g, '-')
        : 'Portfolio report'
      doc.save(`${safeName}.pdf`)
    } finally {
      setIsPdfGenerating(false)
      setRenderPdf(false)
    }
  }


  const sleeves = useMemo(() => {
    if (!report) return []
    return stableSort(
      report.contributions.map((item) => item.sleeve),
      (a, b) => a.localeCompare(b)
    )
  }, [report, portfolioReturnMap, underlyingBySymbol])

  const selectedContribution = useMemo(() => {
    if (!report) return null
    const sleeve = selectedSleeve ?? report.contributions[0]?.sleeve
    return report.contributions.find((item) => item.sleeve === sleeve) ?? null
  }, [report, selectedSleeve])

  const selectedSleeveMetrics = useMemo(() => {
    if (!report || !selectedContribution) return null
    const underlying = getUnderlyingForSymbol(
      selectedContribution.symbol,
      selectedContribution.sleeve
    )
    return computeSleeveMetrics(
      selectedContribution,
      portfolioReturnMap,
      rollingWindow,
      underlying
    )
  }, [report, selectedContribution, portfolioReturnMap, rollingWindow, underlyingBySymbol])

  const performanceRows = useMemo<PerformanceRow[]>(() => {
    if (!report) return []
    return report.contributions.map((item, index) => {
      const pnl = getSeriesValues(item.pnl)
      const returns = getSeriesValues(item.returns)
      const totalPnl = sumFinite(pnl)
      const meanReturn = computeMean(returns)
      const meanAnn = meanReturn * 252 * 100
      const sharpe = computeSharpe(returns)
      const last2yReturns = returns.slice(-metricWindow.long)
      const last2yPnl = sumFinite(pnl.slice(-metricWindow.long))
      const last2yMean = computeMean(last2yReturns)
      const last2yMeanAnn = last2yMean * 252 * 100
      const last2ySharpe = computeSharpe(last2yReturns)
      const sleeveParts = splitSleeveLabel(item.sleeve)

      return {
        id: index,
        sleeve: sleeveParts.sleeve,
        symbol: sleeveParts.symbol || item.symbol,
        totalPnl,
        meanAnn,
        sharpe,
        last2yPnl,
        last2yMeanAnn,
        last2ySharpe,
      }
    })
  }, [report])

  const riskRows = useMemo<RiskRow[]>(() => {
    if (!report) return []
    return report.contributions.map((item, index) => {
      const drawdownPercent = getSleeveDrawdown(item)
      const returns = sanitizeSeries(getSeriesValues(item.returns))
      const minObs = Math.floor(metricWindow.long * 0.8)
      const minActive = Math.floor(metricWindow.long * 0.2)
      const underlying = getUnderlyingForSymbol(item.symbol, item.sleeve)
      const returnsMap =
        underlying && underlying.length > 0 ? buildReturnMap(underlying) : portfolioReturnMap
      const alignedPrimary = alignPairsByDay(item.returns, returnsMap)
      const aligned =
        returnsMap !== portfolioReturnMap && alignedPrimary.validCount < minObs
          ? alignPairsByDay(item.returns, portfolioReturnMap)
          : alignedPrimary
      const alphaSeries = rollingOlsPairs(aligned.xs, aligned.ys, metricWindow.long, {
        minObs,
        minActive,
      }).alpha
      const alphaPercentiles = computeAlphaPercentiles(alphaSeries)
      const alphaPct = getLastFinite(alphaPercentiles)
      const last1YSharpe = getLastFinite(rollingSharpe(returns, metricWindow.short))
      const last2YSharpe = getLastFinite(rollingSharpe(returns, metricWindow.long))
      const overallSharpe = computeSharpe(returns)
      const winrateSeries = rollingWinrate(returns, metricWindow.long)
      const last2YWinrate = getLastFinite(winrateSeries)
      const shock = computeDdShock(drawdownPercent).flag
      const alphaPctFinite = Number.isFinite(alphaPct) ? alphaPct : null
      const redTriggers: string[] = []
      const yellowTriggers: string[] = []
      if (alphaPctFinite != null && alphaPctFinite < 15) {
        yellowTriggers.push('alpha pctile < 15')
      } else if (alphaPctFinite != null && alphaPctFinite < 40) {
        yellowTriggers.push('alpha pctile 15–40')
      }
      const negSharpe = Number.isFinite(overallSharpe) && overallSharpe < 0
      if (negSharpe) {
        redTriggers.push('Overall Sharpe < 0')
      }
      if (Number.isFinite(last1YSharpe) && last1YSharpe < 0) {
        yellowTriggers.push('1Y Sharpe < 0')
      }
      if (shock === 'ORANGE') {
        yellowTriggers.push('dd shock ORANGE')
        if (negSharpe) {
          redTriggers.push('dd shock ORANGE')
        }
      }
      if (shock === 'RED') {
        redTriggers.push('dd shock RED')
      }
      const status = computeStatus({
        alphaSeries: alphaSeries,
        winrateSeries,
        last1YSharpe: Number.isFinite(last1YSharpe) ? last1YSharpe : null,
        last2YSharpe: Number.isFinite(last2YSharpe) ? last2YSharpe : null,
        overallSharpe: Number.isFinite(overallSharpe) ? overallSharpe : null,
        last2YWinrate: Number.isFinite(last2YWinrate) ? last2YWinrate : null,
        shock,
      })
      const reasonSummary =
        status.status === 'RED'
          ? `Reason: ${
              redTriggers.length > 0
                ? redTriggers.join('; ')
                : 'Overall Sharpe < 0'
            }.`
          : status.status === 'YELLOW'
            ? `Reason: ${yellowTriggers.length > 0 ? yellowTriggers.join('; ') : 'insufficient signal for green'}.`
            : 'Reason: alpha pctile >= 40 and 2Y Sharpe > 0.5.'
      const reasons = [reasonSummary]
      const action =
        status.status === 'RED'
          ? 'Reduce weight 50–100%, recheck in 3 months.'
          : status.status === 'YELLOW'
            ? 'Keep weight, recheck in 4–6 weeks.'
            : 'No change.'
      const sleeveParts = splitSleeveLabel(item.sleeve)

      return {
        id: index,
        sleeve: sleeveParts.sleeve,
        symbol: sleeveParts.symbol || item.symbol,
        status: status.status,
        shock: status.shock,
        alphaPct: Number.isFinite(alphaPct) ? alphaPct : null,
        winratePctile: status.winratePercentile,
        last1ySharpe: status.last1YSharpe,
        last2ySharpe: status.last2YSharpe,
        overallSharpe: status.overallSharpe,
        last2yWinrate: status.last2YWinrate,
        statusReasons: reasons.join('\n'),
        statusAction: action,
      }
    })
  }, [report, drawdownMode])

  const pdfPerformanceRows = useMemo(() => {
    if (!pdfObfuscate || !pdfObfuscation) return performanceRows
    return performanceRows.map((row) => ({
      ...row,
      sleeve: pdfObfuscation.formatSleeve(row.sleeve, row.symbol ?? ''),
      symbol: row.symbol ? pdfObfuscation.formatSymbol(row.symbol) : row.symbol,
    }))
  }, [performanceRows, pdfObfuscate, pdfObfuscation])

  const pdfRiskRows = useMemo(() => {
    if (!pdfObfuscate || !pdfObfuscation) return riskRows
    return riskRows.map((row) => ({
      ...row,
      sleeve: pdfObfuscation.formatSleeve(row.sleeve, row.symbol ?? ''),
      symbol: row.symbol ? pdfObfuscation.formatSymbol(row.symbol) : row.symbol,
    }))
  }, [riskRows, pdfObfuscate, pdfObfuscation])

  const metricColumns = useMemo<GridColDef[]>(() => {
    const renderSigned = (value: number | null, formatted: string) => (
      <Box component="span" sx={{ color: value != null && value < 0 ? negativeColor : 'inherit' }}>
        {formatted}
      </Box>
    )
    return [
      { field: 'sleeve', headerName: 'Sleeve', flex: 1.2, minWidth: 180 },
      {
        field: 'symbol',
        headerName: 'Symbol',
        flex: 0.8,
        minWidth: 130,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.symbol || '-'}
            sx={getSymbolChipStyles(params.row.symbol as string, isDark)}
          />
        ),
      },
      {
        field: 'totalPnl',
        headerName: 'Total PnL',
        flex: 0.9,
        minWidth: 130,
        renderCell: (params) =>
          renderSigned(
            params.row.totalPnl as number | null,
            formatCurrency(params.row.totalPnl as number | null)
          ),
      },
      {
        field: 'meanAnn',
        headerName: 'Mean ann %',
        flex: 0.8,
        minWidth: 140,
        renderCell: (params) =>
          renderSigned(
            params.row.meanAnn as number | null,
            formatPercent(params.row.meanAnn as number | null, 2)
          ),
      },
      {
        field: 'sharpe',
        headerName: 'Sharpe',
        flex: 0.6,
        minWidth: 110,
        renderCell: (params) =>
          renderSigned(
            params.row.sharpe as number | null,
            formatNumber(params.row.sharpe as number | null, 2)
          ),
      },
      {
        field: 'last2yPnl',
        headerName: 'Last 2Y PnL',
        flex: 0.8,
        minWidth: 140,
        renderCell: (params) =>
          renderSigned(
            params.row.last2yPnl as number | null,
            formatCurrency(params.row.last2yPnl as number | null)
          ),
      },
      {
        field: 'last2yMeanAnn',
        headerName: 'Last 2Y Mean ann %',
        flex: 0.9,
        minWidth: 180,
        renderCell: (params) =>
          renderSigned(
            params.row.last2yMeanAnn as number | null,
            formatPercent(params.row.last2yMeanAnn as number | null, 2)
          ),
      },
      {
        field: 'last2ySharpe',
        headerName: 'Last 2Y Sharpe',
        flex: 0.8,
        minWidth: 150,
        renderCell: (params) =>
          renderSigned(
            params.row.last2ySharpe as number | null,
            formatNumber(params.row.last2ySharpe as number | null, 2)
          ),
      },
    ]
  }, [isDark, negativeColor])

  const riskColumns = useMemo<GridColDef[]>(() => {
    const renderSigned = (value: number | null, formatted: string) => (
      <Box component="span" sx={{ color: value != null && value < 0 ? negativeColor : 'inherit' }}>
        {formatted}
      </Box>
    )
    return [
      { field: 'sleeve', headerName: 'Sleeve', flex: 1.2, minWidth: 180 },
      {
        field: 'symbol',
        headerName: 'Symbol',
        flex: 0.8,
        minWidth: 130,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.symbol || '-'}
            sx={getSymbolChipStyles(params.row.symbol as string, isDark)}
          />
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.6,
        minWidth: 180,
        headerClassName: 'status-header',
        renderHeader: () => (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Status
            </Typography>
            <Tooltip
              placement="top"
              slotProps={{ tooltip: { sx: { maxWidth: 600 } } }}
              title={
                <Box sx={{ p: 1, maxWidth: 600 }}>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                    Status Legend
                  </Typography>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label="GREEN"
                        sx={{
                          backgroundColor: theme.palette.success.main,
                          color: theme.palette.getContrastText(theme.palette.success.main),
                        }}
                      />
                      <Typography variant="caption">
                        <strong>Alpha pctile</strong> {'\u2265'} 40 and <strong>2Y Sharpe</strong>{' '}
                        {'>'} 0.5
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label="YELLOW"
                        sx={{
                          backgroundColor: theme.palette.warning.dark,
                          color: theme.palette.getContrastText(theme.palette.warning.dark),
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        <strong>Alpha pctile</strong> {'<'} 40 or <strong>1Y Sharpe</strong> {'<'} 0
                        or <strong> DD shock</strong> ORANGE
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label="RED"
                        sx={{
                          backgroundColor: theme.palette.error.dark,
                          color: theme.palette.getContrastText(theme.palette.error.dark),
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        <strong>DD shock</strong> RED or <strong>Overall Sharpe</strong> {'<'} 0
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label="SHOCK"
                        sx={{
                          backgroundColor: theme.palette.warning.dark,
                          color: theme.palette.getContrastText(theme.palette.warning.dark),
                        }}
                      />
                      <Typography variant="caption">
                        ORANGE downgrades GREEN → YELLOW; RED forces RED
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              }
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'text.secondary',
                }}
              >
                <HelpOutlineOutlinedIcon fontSize="small" />
              </Box>
            </Tooltip>
          </Stack>
        ),
        renderCell: (params) => {
          const value = String(params.row.status ?? '')
          const color =
            value === 'GREEN'
              ? theme.palette.success.main
              : value === 'YELLOW'
                ? theme.palette.warning.dark
                : value === 'RED'
                  ? theme.palette.error.dark
                  : theme.palette.grey[600]
          const textColor = theme.palette.getContrastText(color)
          const shock = String(params.row.shock ?? '')
          const severityColor =
            value === 'RED'
              ? theme.palette.error.light
              : value === 'YELLOW' || shock === 'ORANGE'
                ? theme.palette.warning.light
                : theme.palette.error.light
          const formatMetric = (label: string, raw: string, bad: boolean) => (
            <Typography
              key={label}
              variant="caption"
              sx={{
                display: 'block',
                color: bad ? severityColor : 'inherit',
                fontWeight: bad ? 700 : 400,
              }}
            >
              • {label} {raw}
            </Typography>
          )
          const metrics = [
            formatMetric(
              'alpha pctile',
              params.row.alphaPct != null ? `${Math.round(params.row.alphaPct)}%` : 'n/a',
              params.row.alphaPct == null || params.row.alphaPct < 40
            ),
            formatMetric(
              'winrate pctile',
              params.row.winratePctile != null ? `${Math.round(params.row.winratePctile)}%` : 'n/a',
              params.row.winratePctile != null && params.row.winratePctile < 20
            ),
            formatMetric(
              'last 1Y sharpe',
              params.row.last1ySharpe != null ? params.row.last1ySharpe.toFixed(2) : 'n/a',
              params.row.last1ySharpe != null && params.row.last1ySharpe < 0
            ),
            formatMetric(
              'last 2Y sharpe',
              params.row.last2ySharpe != null ? params.row.last2ySharpe.toFixed(2) : 'n/a',
              params.row.last2ySharpe != null && params.row.last2ySharpe < 0
            ),
            formatMetric(
              'overall sharpe',
              params.row.overallSharpe != null ? params.row.overallSharpe.toFixed(2) : 'n/a',
              params.row.overallSharpe != null && params.row.overallSharpe < 0
            ),
            formatMetric(
              'last 2Y winrate',
              params.row.last2yWinrate != null
                ? `${Math.round(params.row.last2yWinrate * 100)}%`
                : 'n/a',
              false
            ),
          ]
          if (shock !== 'NONE') {
            metrics.push(
              formatMetric('dd shock', shock, shock === 'RED' || shock === 'ORANGE')
            )
          }
          return (
            <Tooltip
              placement="top"
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                    Reasons
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {params.row.statusReasons || 'n/a'}
                  </Typography>
                  {metrics}
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', fontWeight: 600, mt: 0.5 }}
                  >
                    Action
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {params.row.statusAction || 'n/a'}
                  </Typography>
                </Box>
              }
            >
              <Chip
                size="small"
                label={value || '-'}
                sx={{
                  backgroundColor: color,
                  color: textColor,
                  fontWeight: 500,
                  borderColor: color,
                }}
              />
            </Tooltip>
          )
        },
      },
      {
        field: 'shock',
        headerName: 'Shock',
        flex: 0.6,
        minWidth: 160,
        headerClassName: 'shock-header',
        renderHeader: () => (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Shock
            </Typography>
            <Tooltip
              placement="top"
              slotProps={{ tooltip: { sx: { maxWidth: 360 } } }}
              title={
                <Box sx={{ p: 1 }}>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                    DD Shock Logic
                  </Typography>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label="ORANGE"
                        sx={{
                          backgroundColor: theme.palette.warning.main,
                          color: theme.palette.getContrastText(theme.palette.warning.main),
                        }}
                      />
                      <Typography variant="caption">
                        Downgrades GREEN → YELLOW
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label="RED"
                        sx={{
                          backgroundColor: theme.palette.error.main,
                          color: theme.palette.getContrastText(theme.palette.error.main),
                        }}
                      />
                      <Typography variant="caption">Forces RED status</Typography>
                    </Stack>
                    <Typography variant="caption">
                      Based on last <strong>63 trading days</strong> of drawdown magnitude.
                    </Typography>
                    <Typography variant="caption">
                      <strong>ORANGE</strong> when <strong>last-window DD</strong> is ≥{' '}
                      <strong>1.5×</strong> prior max DD, or ≥ <strong>5%</strong> if no prior DD.
                    </Typography>
                    <Typography variant="caption">
                      <strong>RED</strong> when <strong>last-window DD</strong> is ≥{' '}
                      <strong>2.0×</strong> prior max DD.
                    </Typography>
                  </Stack>
                </Box>
              }
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'text.secondary',
                }}
              >
                <HelpOutlineOutlinedIcon fontSize="small" />
              </Box>
            </Tooltip>
          </Stack>
        ),
        renderCell: (params) => {
          const value = String(params.row.shock ?? '')
          const color =
            value === 'NONE'
              ? theme.palette.grey[600]
              : value === 'ORANGE'
                ? theme.palette.warning.main
                : value === 'RED'
                  ? theme.palette.error.main
                  : theme.palette.grey[600]
          const textColor = theme.palette.getContrastText(color)
          return (
            <Chip
              size="small"
              label={value || '-'}
              sx={{
                backgroundColor: color,
                color: textColor,
                fontWeight: value === 'YELLOW' || value === 'RED' ? 700 : 600,
                borderColor: color,
              }}
            />
          )
        },
      },
      {
        field: 'alphaPct',
        headerName: 'Alpha pctile',
        flex: 0.8,
        minWidth: 140,
        renderCell: (params) =>
          renderSigned(
            params.row.alphaPct as number | null,
            formatPercent(params.row.alphaPct as number | null, 0)
          ),
      },
      {
        field: 'last1ySharpe',
        headerName: 'Last 1Y Sharpe',
        flex: 0.8,
        minWidth: 150,
        renderCell: (params) =>
          renderSigned(
            params.row.last1ySharpe as number | null,
            formatNumber(params.row.last1ySharpe as number | null, 2)
          ),
      },
      {
        field: 'last2ySharpe',
        headerName: 'Last 2Y Sharpe',
        flex: 0.8,
        minWidth: 150,
        renderCell: (params) =>
          renderSigned(
            params.row.last2ySharpe as number | null,
            formatNumber(params.row.last2ySharpe as number | null, 2)
          ),
      },
      {
        field: 'last2yWinrate',
        headerName: 'Last 2Y Winrate',
        flex: 0.8,
        minWidth: 150,
        renderCell: (params) => formatRate(params.row.last2yWinrate as number | null, 1),
      },
    ]
  }, [isDark, negativeColor])

  const correlationMatrix = useMemo<CorrelationMatrix>(() => {
    if (!report) return { labels: [], values: [] }
    const labels = stableSort(
      report.contributions.map((item) => item.sleeve),
      (a, b) => a.localeCompare(b)
    )
    const returnsBySleeve = new Map(
      report.contributions.map((item) => [item.sleeve, getSeriesValues(item.returns)])
    )
    const safeCorrelation = (seriesA: number[], seriesB: number[]) => {
      const pairs: [number, number][] = []
      const len = Math.min(seriesA.length, seriesB.length)
      for (let i = 0; i < len; i += 1) {
        const a = seriesA[i]
        const b = seriesB[i]
        if (Number.isFinite(a) && Number.isFinite(b)) {
          pairs.push([a, b])
        }
      }
      if (pairs.length < 2) return null
      const xs = pairs.map((pair) => pair[0])
      const ys = pairs.map((pair) => pair[1])
      const value = correlation(xs, ys)
      return Number.isFinite(value) ? value : null
    }
    const values = labels.map((a) =>
      labels.map((b) => {
        const seriesA = returnsBySleeve.get(a) ?? []
        const seriesB = returnsBySleeve.get(b) ?? []
        return safeCorrelation(seriesA, seriesB)
      })
    )
    return { labels, values }
  }, [report])

  const pdfCorrelationLabels = useMemo(() => {
    if (!pdfObfuscate || !pdfObfuscation) return correlationMatrix.labels
    return correlationMatrix.labels.map((label) => pdfObfuscation.formatSleeveLabel(label))
  }, [correlationMatrix.labels, pdfObfuscate, pdfObfuscation])

  const pdfCorrelationCellSize = useMemo(() => {
    const labelCount = pdfCorrelationLabels.length
    if (labelCount === 0) return cellSize
    const available = Math.max(0, pdfPageWidth - 64)
    const candidate = Math.floor(available / (labelCount + 1))
    return Math.max(16, Math.min(cellSize, candidate))
  }, [pdfCorrelationLabels.length, pdfPageWidth, cellSize])

  const reportMeta = report
    ? `Deals: ${report.dealsSourceName?.trim() || 'Unknown file'} • Generated: ${
        report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'Unknown time'
      }`
    : ''
  const canApplyMarDegradation = !!(baseDeals ?? deals)?.length

  if (!report) return null

  const contextValue = useMemo(
    () => ({
      tab,
      report,
      deals,
      performanceRows,
      gridPerformanceColumns: metricColumns,
      riskRows,
      gridRiskColumns: riskColumns,
      sleeves,
      selectedContribution,
      selectedSleeveMetrics,
      buildSleeveMetrics,
      sleeveViewMode,
      onSleeveViewModeChange: handleSleeveViewModeChange,
      drawdownMode,
      onDrawdownModeChange: handleDrawdownModeChange,
      hasMtmDrawdown,
      pnlScaleMode,
      onPnlScaleModeChange: handlePnlScaleModeChange,
      rollingWindow,
      onRollingWindowChange: handleRollingWindowChange,
      metricWindow,
      baseCapital,
      pnlColor,
      axisColor,
      gridColor,
      theme,
      isDark,
      getSleeveDrawdown,
      getSleeveDrawdownSource,
      allSleevesPlaceholderHeight: ALL_SLEEVES_PLACEHOLDER_HEIGHT,
      portfolioDrawdown,
      portfolioDrawdownSource,
      showCorrNumbers,
      onShowCorrNumbersChange: handleShowCorrNumbersChange,
      correlationMatrix,
      correlationLegend,
      cellSize,
      portfolioSummary,
      pdfPerformanceRows,
      pdfRiskRows,
      pdfPerformanceColumns,
      pdfRiskColumns,
      pdfName,
      pdfPageWidth,
      pdfPageMinHeight,
      pdfCorrelationCellSize,
      pdfCorrelationLabels,
      lightTheme,
      printPnlColor,
      printAxisColor,
      printGridColor,
      formatPdfSleeveLabel,
      formatPdfSymbol,
      onSelectSleeve: handleSelectSleeve,
      underlyingTimeframes,
      underlyingSeries,
    }),
    [
      tab,
      report,
      deals,
      performanceRows,
      metricColumns,
      riskRows,
      riskColumns,
      sleeves,
      selectedContribution,
      selectedSleeveMetrics,
      buildSleeveMetrics,
      sleeveViewMode,
      handleSleeveViewModeChange,
      drawdownMode,
      handleDrawdownModeChange,
      hasMtmDrawdown,
      pnlScaleMode,
      handlePnlScaleModeChange,
      rollingWindow,
      handleRollingWindowChange,
      metricWindow,
      baseCapital,
      pnlColor,
      axisColor,
      gridColor,
      theme,
      isDark,
      getSleeveDrawdown,
      getSleeveDrawdownSource,
      portfolioDrawdown,
      portfolioDrawdownSource,
      showCorrNumbers,
      handleShowCorrNumbersChange,
      correlationMatrix,
      correlationLegend,
      cellSize,
      portfolioSummary,
      pdfPerformanceRows,
      pdfRiskRows,
      pdfName,
      pdfPageWidth,
      pdfPageMinHeight,
      pdfCorrelationCellSize,
      pdfCorrelationLabels,
      lightTheme,
      printPnlColor,
      printAxisColor,
      printGridColor,
      formatPdfSleeveLabel,
      formatPdfSymbol,
      handleSelectSleeve,
      pdfPerformanceColumns,
      pdfRiskColumns,
      underlyingTimeframes,
      underlyingSeries,
    ]
  )

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
        <Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Typography variant="h5">Report Analytics</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {reportMeta}
            </Typography>
            {marDegradationPct != null && marDegradationPct > 0 && (
              <Chip
                size="medium"
                label={`MAR Degradation -${marDegradationPct}%`}
                sx={{ ml: { md: 1 } }}
                variant='outlined'
                onDelete={handleRemoveMarDegradation}
              />
            )}
            <Button
              variant="outlined"
              onClick={handlePrintReport}
              disabled={isPdfGenerating}
              startIcon={<PictureAsPdfOutlinedIcon />}
            >
              Generate PDF report
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                resetWizard()
                clearUnderlying()
                clearReport()
              }}
              startIcon={<ReplayOutlinedIcon />}
            >
              Regenerate report
            </Button>
            <IconButton
              aria-label="Report actions"
              onClick={handleMenuOpen}
              size="small"
            >
              <MoreVertOutlinedIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchorEl}
              open={isMenuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  handleMenuClose()
                  setMarDialogOpen(true)
                }}
                disabled={
                  marDegradationPct != null || !canApplyMarDegradation || isMarApplying
                }
              >
                <TrendingDownOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
                Apply MAR degradation
              </MenuItem>
            </Menu>
          </Stack>
          <Tabs
            value={tab}
            onChange={(_event: SyntheticEvent, value: TabValue) => setTab(value)}
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                minHeight: 48,
                paddingY: 1,
                paddingX: 1.5,
              },
              '& .MuiTab-iconWrapper': {
                marginRight: 1,
              },
            }}
          >
            <Tab
              label="Performance"
              value="performance"
              icon={<TableChartOutlinedIcon fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              label="Risk / Decay"
              value="risk"
              icon={<AssessmentOutlinedIcon fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              label="Sleeves"
              value="sleeves"
              icon={<ShowChartOutlinedIcon fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              label="Portfolio"
              value="portfolio"
              icon={<PieChartOutlineOutlinedIcon fontSize="small" />}
              iconPosition="start"
            />
          </Tabs>
        </Box>
        <Dialog
          open={pdfDialogOpen}
          onClose={() => setPdfDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Generate PDF report</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Portfolio name"
                value={pdfName}
                onChange={(event) => setPdfName(event.target.value)}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="pdf-orientation-label">Orientation</InputLabel>
                <Select
                  labelId="pdf-orientation-label"
                  value={pdfOrientation}
                  label="Orientation"
                  onChange={(event) =>
                    setPdfOrientation(event.target.value as 'portrait' | 'landscape')
                  }
                >
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="landscape">Landscape</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={pdfObfuscate}
                    onChange={(event) => setPdfObfuscate(event.target.checked)}
                  />
                }
                label="Obfuscate sleeve and symbol names"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={() => setPdfDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleGeneratePdf}>
              Generate PDF
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={marDialogOpen}
          onClose={() => setMarDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Apply MAR degradation</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Degrade MAR by (%)"
                type="number"
                value={marDegradeInput}
                onChange={(event) => setMarDegradeInput(event.target.value)}
                inputProps={{ min: 0, step: 1 }}
                helperText="Adds slippage to all trades to reduce MAR by the chosen percentage."
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={() => setMarDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleApplyMarDegradation}
              disabled={!canApplyMarDegradation || isMarApplying}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>
        <ReportTabsContent />
        {renderPdf && (
          <ThemeProvider theme={lightTheme}>
            <CssBaseline />
            <Box
              ref={pdfContainerRef}
              sx={{
                position: 'fixed',
                left: -10000,
                top: 0,
                width: pdfPageWidth,
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              <ReportPdf />
            </Box>
          </ThemeProvider>
        )}
        <Backdrop
          open={isSleevePending}
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Box sx={{ width: '40%' }}>
            <LinearProgress />
          </Box>
        </Backdrop>
        <Backdrop
          open={isPdfGenerating}
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2 }}
        >
          <Box sx={{ width: '40%' }}>
            <LinearProgress />
          </Box>
        </Backdrop>
        <Backdrop
          open={isMarApplying}
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 3 }}
        >
          <Box sx={{ width: '40%' }}>
            <LinearProgress />
          </Box>
        </Backdrop>
      </Stack>
    </ReportViewProvider>
  )
}

export default ReportView
