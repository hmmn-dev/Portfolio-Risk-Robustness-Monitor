import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TextField,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { correlation } from '../../../engine/correlation'
import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import { stableSort } from '../../../engine/stableSort'
import type { DailyPoint } from '../../../engine/types'
import { computeDdShock } from '../../../engine/ddShock'
import { correlationColor, isLightColor } from '../colors'
import { DrawdownChart, EquityChart } from '../charts'
import {
  formatDrawdownModeLabel,
  formatDrawdownSourceLabel,
  formatSigned,
} from '../formatters'
import { computeSharpe, getSeriesValues } from '../helpers'
import { useReportViewContext } from './ReportViewContext'

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type MonthlyReturnRow = {
  year: number
  months: (number | null)[]
  total: number | null
  maxDrawdown: number | null
}

const buildIndexAndDrawdown = (returns: DailyPoint[]) => {
  let indexValue = 1
  let maxIndex = 1
  const index: DailyPoint[] = []
  const drawdown: DailyPoint[] = []

  returns.forEach((point) => {
    const safeReturn = Number.isFinite(point.value) ? point.value : 0
    indexValue *= 1 + safeReturn
    maxIndex = Math.max(maxIndex, indexValue)
    index.push({ time: point.time, value: indexValue })
    drawdown.push({ time: point.time, value: (indexValue / maxIndex - 1) * 100 })
  })

  return { index, drawdown }
}

const buildMonthlyReturnRows = (
  dailyReturns: DailyPoint[],
  drawdown: DailyPoint[]
): MonthlyReturnRow[] => {
  const yearMap = new Map<number, { months: (number | null)[]; yearProduct: number | null }>()
  dailyReturns.forEach((point) => {
    if (!Number.isFinite(point.value)) return
    const date = new Date(point.time)
    if (Number.isNaN(date.getTime())) return
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const entry = yearMap.get(year) ?? { months: Array(12).fill(null), yearProduct: null }
    const monthProduct = entry.months[month]
    entry.months[month] = (monthProduct == null ? 1 : monthProduct) * (1 + point.value)
    entry.yearProduct = (entry.yearProduct == null ? 1 : entry.yearProduct) * (1 + point.value)
    yearMap.set(year, entry)
  })

  const ddByYear = new Map<number, number>()
  drawdown.forEach((point) => {
    if (!Number.isFinite(point.value)) return
    const date = new Date(point.time)
    if (Number.isNaN(date.getTime())) return
    const year = date.getUTCFullYear()
    const current = ddByYear.get(year)
    if (!Number.isFinite(current ?? NaN) || (point.value as number) < (current as number)) {
      ddByYear.set(year, point.value as number)
    }
  })

  return stableSort(Array.from(yearMap.keys()), (a, b) => a - b).map((year) => {
    const entry = yearMap.get(year) as { months: (number | null)[]; yearProduct: number | null }
    const months = entry.months.map((product) => (product == null ? null : product - 1))
    const total = entry.yearProduct == null ? null : entry.yearProduct - 1
    const maxDrawdown = ddByYear.get(year) ?? null
    return { year, months, total, maxDrawdown }
  })
}

const buildDefaultWeights = (labels: string[]) =>
  Object.fromEntries(labels.map((label) => [label, 1]))

const formatWeightValue = (value: number) => value.toFixed(2)

const isWeightInputValue = (value: string) => /^\d*(\.\d{0,2})?$/.test(value)

const resolveGlobalWeightDraft = (draft: Record<string, string>, labels: string[]) => {
  if (labels.length === 0) return ''
  let value: string | null = null
  for (const label of labels) {
    const next = draft[label] ?? ''
    if (value == null) {
      value = next
      continue
    }
    if (next !== value) return ''
  }
  return value ?? ''
}

const PortfolioTab = () => {
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
  } = useReportViewContext()
  const sleeveLabels = useMemo(
    () =>
      stableSort(
        Array.from(new Set(report.contributions.map((item) => item.sleeve))),
        (a, b) => a.localeCompare(b)
      ),
    [report.contributions]
  )
  const sleeveKey = sleeveLabels.join('||')
  const [enabledSleeves, setEnabledSleeves] = useState<Set<string>>(() => new Set(sleeveLabels))
  const [sleeveDialogOpen, setSleeveDialogOpen] = useState(false)
  const [sleeveDraft, setSleeveDraft] = useState<Set<string>>(new Set(sleeveLabels))
  const [sleeveWeights, setSleeveWeights] = useState<Record<string, number>>(() =>
    buildDefaultWeights(sleeveLabels)
  )
  const [sleeveWeightDraft, setSleeveWeightDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(sleeveLabels.map((label) => [label, formatWeightValue(1)]))
  )
  const [globalWeightDraft, setGlobalWeightDraft] = useState(formatWeightValue(1))

  useEffect(() => {
    setEnabledSleeves(new Set(sleeveLabels))
    setSleeveWeights(buildDefaultWeights(sleeveLabels))
    setSleeveWeightDraft(
      Object.fromEntries(sleeveLabels.map((label) => [label, formatWeightValue(1)]))
    )
    setGlobalWeightDraft(formatWeightValue(1))
  }, [sleeveKey])

  const openSleeveDialog = () => {
    setSleeveDraft(new Set(enabledSleeves))
    const nextDraft = Object.fromEntries(
      sleeveLabels.map((label) => [
        label,
        formatWeightValue(sleeveWeights[label] ?? 1),
      ])
    )
    setSleeveWeightDraft(nextDraft)
    setGlobalWeightDraft(resolveGlobalWeightDraft(nextDraft, sleeveLabels))
    setSleeveDialogOpen(true)
  }

  const toggleSleeveDraft = (label: string) => {
    setSleeveDraft((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const updateSleeveWeightDraft = (label: string, value: string) => {
    if (!isWeightInputValue(value)) return
    setSleeveWeightDraft((prev) => {
      const next = { ...prev, [label]: value }
      setGlobalWeightDraft(resolveGlobalWeightDraft(next, sleeveLabels))
      return next
    })
  }

  const updateGlobalWeightDraft = (value: string) => {
    if (!isWeightInputValue(value)) return
    setGlobalWeightDraft(value)
  }

  const applyGlobalWeightDraft = () => {
    if (globalWeightDraft === '') return
    setSleeveWeightDraft(
      Object.fromEntries(sleeveLabels.map((label) => [label, globalWeightDraft]))
    )
  }

  const resetSleeveWeightDraft = () => {
    setSleeveWeightDraft(
      Object.fromEntries(sleeveLabels.map((label) => [label, formatWeightValue(1)]))
    )
    setGlobalWeightDraft(formatWeightValue(1))
  }

  const applySleeveSelection = () => {
    if (sleeveDraft.size === 0) return
    setEnabledSleeves(new Set(sleeveDraft))
    const nextWeights: Record<string, number> = {}
    sleeveLabels.forEach((label) => {
      const raw = sleeveWeightDraft[label]
      const parsed = Number(raw)
      const normalized = Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 1
      nextWeights[label] = normalized
    })
    setSleeveWeights(nextWeights)
    setSleeveDialogOpen(false)
  }

  const enabledCount = enabledSleeves.size
  const totalSleeves = sleeveLabels.length
  const isWeightDraftValid = sleeveLabels.every((label) => {
    const value = sleeveWeightDraft[label]
    if (value == null || value === '') return false
    const parsed = Number(value)
    return Number.isFinite(parsed)
  })
  const isApplyDisabled = sleeveDraft.size === 0 || !isWeightDraftValid
  const isFiltered = enabledCount !== totalSleeves
  const hasCustomWeights = useMemo(
    () =>
      sleeveLabels.some((label) => {
        const weight = sleeveWeights[label] ?? 1
        return Number.isFinite(weight) && Math.abs(weight - 1) > 1e-6
      }),
    [sleeveLabels, sleeveWeights]
  )
  const usesCustomPortfolio = isFiltered || hasCustomWeights
  const activeContributions = useMemo(
    () => report.contributions.filter((item) => enabledSleeves.has(item.sleeve)),
    [report.contributions, enabledSleeves]
  )
  const customPortfolio = useMemo(() => {
    if (!usesCustomPortfolio) return null
    const dayTimes = report.portfolio.days.map((day) => day.time)
    const returnMaps = new Map<string, Map<number, number>>()
    activeContributions.forEach((item) => {
      const map = new Map<number, number>()
      item.returns.forEach((point) => {
        map.set(point.time, Number.isFinite(point.value) ? point.value : 0)
      })
      returnMaps.set(item.sleeve, map)
    })
    const dailyReturns = dayTimes.map((time) => {
      let total = 0
      activeContributions.forEach((item) => {
        const value = returnMaps.get(item.sleeve)?.get(time)
        if (Number.isFinite(value ?? NaN)) {
          const weight = sleeveWeights[item.sleeve] ?? 1
          total += (value as number) * weight
        }
      })
      return { time, value: total }
    })
    const indexAndDrawdown = buildIndexAndDrawdown(dailyReturns)
    return {
      index: indexAndDrawdown.index,
      drawdown: indexAndDrawdown.drawdown,
      returns: dailyReturns.map((point) => point.value),
    }
  }, [usesCustomPortfolio, activeContributions, report.portfolio.days, sleeveWeights])

  const customPortfolioSummary = useMemo(() => {
    if (!customPortfolio || !customPortfolio.index.length) {
      return {
        totalReturnPct: Number.NaN,
        cagr: Number.NaN,
        maxDrawdown: Number.NaN,
        mar: Number.NaN,
        sharpe: Number.NaN,
        regression: null,
      }
    }
    const portfolioIndex = customPortfolio.index
    const totalReturnPct =
      (portfolioIndex[portfolioIndex.length - 1].value - 1) * 100
    const startIndex = portfolioIndex[0]?.value ?? Number.NaN
    const endIndex = portfolioIndex[portfolioIndex.length - 1]?.value ?? Number.NaN
    const startTime = portfolioIndex[0]?.time ?? Number.NaN
    const endTime = portfolioIndex[portfolioIndex.length - 1]?.time ?? Number.NaN
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
    const maxDrawdown = customPortfolio.drawdown.reduce(
      (min, point) => (point.value < min ? point.value : min),
      0
    )
    const mar = maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : Number.NaN
    const sharpe = computeSharpe(customPortfolio.returns)
    return {
      totalReturnPct,
      cagr,
      maxDrawdown,
      mar,
      sharpe,
      regression: null,
    }
  }, [customPortfolio])

  const filteredCorrelationMatrix = useMemo(() => {
    const labels = stableSort(
      activeContributions.map((item) => item.sleeve),
      (a, b) => a.localeCompare(b)
    )
    const returnsBySleeve = new Map(
      activeContributions.map((item) => [item.sleeve, getSeriesValues(item.returns)])
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
  }, [activeContributions])

  const filteredMtm = useMemo(() => {
    if (!isFiltered || drawdownMode !== 'mtm') return null
    if (!deals || deals.length === 0) return null
    if (!underlyingSeries.length) return null
    const filteredDeals = deals.filter((deal) => enabledSleeves.has(deal.sleeve))
    if (filteredDeals.length === 0) return null
    const filteredReport = buildPortfolioReport(filteredDeals, {
      generatedAt: report.generatedAt,
      dealsSourceName: report.dealsSourceName,
      underlyingTimeframes,
      underlyingSeries,
      initialCapital: baseCapital,
    })
    return {
      drawdown: filteredReport.portfolio.drawdownMtm ?? [],
      source: filteredReport.portfolio.drawdownMtmSource,
    }
  }, [
    isFiltered,
    drawdownMode,
    deals,
    enabledSleeves,
    report.generatedAt,
    report.dealsSourceName,
    underlyingTimeframes,
    underlyingSeries,
    baseCapital,
  ])

  const hasFilteredMtm = (filteredMtm?.drawdown.length ?? 0) > 0
  const hasPortfolioMtm = (report.portfolio.drawdownMtm?.length ?? 0) > 0
  const effectiveDrawdownMode =
    drawdownMode === 'mtm' && (!isFiltered ? hasPortfolioMtm : hasFilteredMtm) ? 'mtm' : 'deal'
  const effectivePortfolioDrawdown =
    effectiveDrawdownMode === 'mtm'
      ? isFiltered
        ? filteredMtm?.drawdown ?? []
        : report.portfolio.drawdownMtm ?? portfolioDrawdown
      : usesCustomPortfolio
        ? customPortfolio?.drawdown ?? []
        : portfolioDrawdown
  const effectivePortfolioDrawdownSource =
    effectiveDrawdownMode === 'mtm'
      ? isFiltered
        ? filteredMtm?.source
        : report.portfolio.drawdownMtmSource
      : portfolioDrawdownSource
  const effectivePortfolioIndex = usesCustomPortfolio
    ? customPortfolio?.index ?? []
    : report.portfolio.index
  const effectiveDailyReturns = useMemo(() => {
    if (usesCustomPortfolio) {
      const filteredReturns = customPortfolio?.returns ?? []
      return report.portfolio.days.map((day, idx) => ({
        time: day.time,
        value: filteredReturns[idx] ?? Number.NaN,
      }))
    }
    return report.portfolio.days.map((day) => ({
      time: day.time,
      value: day.return,
    }))
  }, [usesCustomPortfolio, customPortfolio, report.portfolio.days])
  const effectivePortfolioSummary = useMemo(() => {
    const baseSummary = usesCustomPortfolio ? customPortfolioSummary : portfolioSummary
    if (!baseSummary) return null
    const maxDrawdown = effectivePortfolioDrawdown.reduce(
      (min, point) => (point.value < min ? point.value : min),
      0
    )
    const mar =
      maxDrawdown < 0 && Number.isFinite(baseSummary.cagr)
        ? baseSummary.cagr / Math.abs(maxDrawdown)
        : Number.NaN
    return {
      ...baseSummary,
      maxDrawdown,
      mar,
    }
  }, [
    usesCustomPortfolio,
    customPortfolioSummary,
    portfolioSummary,
    effectivePortfolioDrawdown,
  ])
  const effectiveCorrelationMatrix = isFiltered ? filteredCorrelationMatrix : correlationMatrix
  const effectiveBaseCapital = baseCapital
  const monthlyReturns = useMemo(
    () => buildMonthlyReturnRows(effectiveDailyReturns, effectivePortfolioDrawdown),
    [effectiveDailyReturns, effectivePortfolioDrawdown]
  )
  const heatCellColor = (value: number | null) => {
    if (!Number.isFinite(value ?? NaN)) return theme.palette.action.hover
    const abs = Math.abs(value as number)
    const level = abs >= 0.1 ? 2 : abs >= 0.03 ? 1 : 0
    const positive = (value as number) >= 0
    if (positive) {
      return level === 2
        ? theme.palette.success.dark
        : level === 1
          ? theme.palette.success.main
          : theme.palette.success.light
    }
    return level === 2
      ? theme.palette.error.dark
      : level === 1
        ? theme.palette.error.main
        : theme.palette.error.light
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" size="small" onClick={openSleeveDialog}>
              Change portfolio composition
          </Button>
          {isFiltered && (
            <Typography variant="caption" color="text.secondary">
              {enabledCount} of {totalSleeves} sleeves enabled
            </Typography>
          )}
        </Stack>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
          flexWrap="wrap"
        >
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Portfolio drawdown
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={drawdownMode}
            exclusive
            onChange={(_event, value) => {
              if (value) onDrawdownModeChange(value)
            }}
          >
            <ToggleButton value="deal">Realized</ToggleButton>
            <ToggleButton value="mtm" disabled={!hasMtmDrawdown}>
              In-Trade
            </ToggleButton>
          </ToggleButtonGroup>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
            PnL scale
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={pnlScaleMode}
            exclusive
            onChange={(_event, value) => {
              if (value) onPnlScaleModeChange(value)
            }}
          >
            <ToggleButton value="linear">Linear</ToggleButton>
            <ToggleButton value="log">Log</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2">Portfolio equity</Typography>
            <EquityChart
              data={effectivePortfolioIndex}
              scaleMode="percent"
              pnlScaleMode={pnlScaleMode}
              baseValue={effectiveBaseCapital}
              drawdownSeries={effectivePortfolioDrawdown}
              height={360}
              minOffsetRatio={0}
              reserveGridlines={0}
              color={pnlColor}
              axisColor={axisColor}
              gridColor={gridColor}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2">
              Portfolio drawdown ({formatDrawdownSourceLabel(effectivePortfolioDrawdownSource)})
            </Typography>
            <DrawdownChart
              data={effectivePortfolioDrawdown}
              height={200}
              axisColor={axisColor}
              gridColor={gridColor}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2">Drawdown shock</Typography>
            <Chip label={computeDdShock(effectivePortfolioDrawdown).flag} />
          </Box>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="subtitle2">Portfolio monthly returns</Typography>
            <Typography variant="caption" color="text.secondary">
              Values in percent
            </Typography>
          </Stack>
          <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, minWidth: 64, borderRight: 1, borderColor: 'divider' }}>
                    Year
                  </TableCell>
                  {monthLabels.map((label) => (
                    <TableCell
                      key={label}
                      align="center"
                      sx={{ fontWeight: 700, minWidth: 56, borderRight: 1, borderColor: 'divider' }}
                    >
                      {label}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 72, borderRight: 1, borderColor: 'divider' }}>
                    Total
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 80 }}>
                    MaxDD
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyReturns.map((row) => (
                  <TableRow key={row.year} hover>
                    <TableCell sx={{ fontWeight: 700, borderRight: 1, borderColor: 'divider' }}>
                      {row.year}
                    </TableCell>
                    {row.months.map((value, idx) => {
                      const bg = heatCellColor(value)
                      const textColor = isLightColor(bg)
                        ? theme.palette.text.primary
                        : theme.palette.common.white
                      return (
                        <TableCell
                          key={`${row.year}-${idx}`}
                          align="center"
                          sx={{
                            backgroundColor: bg,
                            color: textColor,
                            fontWeight: 700,
                            borderRight: 1,
                            borderColor: 'divider',
                          }}
                        >
                          {Number.isFinite(value ?? NaN)
                            ? formatSigned((value as number) * 100, 2, '%')
                            : '-'}
                        </TableCell>
                      )
                    })}
                    <TableCell
                      align="center"
                      sx={{ fontWeight: 700, borderRight: 1, borderColor: 'divider' }}
                    >
                      {Number.isFinite(row.total ?? NaN)
                        ? formatSigned((row.total as number) * 100, 2, '%')
                        : '-'}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {Number.isFinite(row.maxDrawdown ?? NaN)
                        ? formatSigned(row.maxDrawdown as number, 2, '%')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Typography variant="subtitle2">Cross-sleeve correlation</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showCorrNumbers}
                onChange={(event) => onShowCorrNumbersChange(event.target.checked)}
              />
            }
            label="Show values"
          />
        </Stack>
        <Box
          sx={{
            mt: 2,
            display: { xs: 'block', lg: 'grid' },
            gridTemplateColumns: { lg: 'auto minmax(280px, 1fr)' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `${cellSize}px repeat(${effectiveCorrelationMatrix.labels.length}, ${cellSize}px)`,
                gridAutoRows: `${cellSize}px`,
                gap: 0,
                alignItems: 'center',
              }}
            >
              <Box />
              {effectiveCorrelationMatrix.labels.map((label, idx) => (
                <Typography
                  key={label}
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    textAlign: 'center',
                    color: theme.palette.text.secondary,
                    fontSize: 11,
                  }}
                >
                  {idx + 1}
                </Typography>
              ))}
              {effectiveCorrelationMatrix.labels.map((label, rowIdx) => (
                <Box key={label} sx={{ display: 'contents' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      textAlign: 'center',
                      color: theme.palette.text.secondary,
                      fontSize: 11,
                    }}
                  >
                    {rowIdx + 1}
                  </Typography>
                  {effectiveCorrelationMatrix.values[rowIdx]?.map((value, colIdx) => {
                    const bg = correlationColor(value)
                    const text = value == null ? '-' : value.toFixed(2)
                    const isLarge = effectiveCorrelationMatrix.labels.length > 12
                    const textColor = isLightColor(bg)
                      ? theme.palette.common.black
                      : theme.palette.common.white
                    return (
                      <Box
                        key={`${label}-${colIdx}`}
                        sx={{
                          width: cellSize,
                          height: cellSize,
                          textAlign: 'center',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderRadius: 0,
                          backgroundColor: bg,
                          color: textColor,
                          fontSize: showCorrNumbers ? (isLarge ? 10 : 12) : 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {showCorrNumbers ? text : ''}
                      </Box>
                    )
                  })}
                </Box>
              ))}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <Typography variant="caption">-1.0</Typography>
              <Box
                sx={{
                  width: 220,
                  height: 10,
                  background: correlationLegend,
                  borderRadius: 999,
                }}
              />
              <Typography variant="caption">1.0</Typography>
            </Stack>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateRows: `repeat(${effectiveCorrelationMatrix.labels.length + 1}, ${cellSize}px)`,
              gridAutoRows: `${cellSize}px`,
              alignItems: 'center',
              minWidth: 280,
            }}
          >
            <Box />
            {effectiveCorrelationMatrix.labels.map((label, idx) => (
              <Typography
                key={label}
                variant="body2"
                sx={{ color: theme.palette.text.primary, fontWeight: 600, pl: 1 }}
              >
                {idx + 1}. {label}
              </Typography>
            ))}
          </Box>
        </Box>
      </Paper>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Portfolio summary
          </Typography>
          {(isFiltered || hasCustomWeights) && (
            <Alert severity="info" variant="outlined">
              Results are based on the selected sleeve series and weights. They may differ from the
              performance you would see if those sleeves were traded together.
            </Alert>
          )}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} flexWrap="wrap">
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                PnL %
              </Typography>
              <Typography variant="h6">
                {formatSigned(effectivePortfolioSummary?.totalReturnPct ?? Number.NaN, 2, '%')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                CAGR %
              </Typography>
              <Typography variant="h6">
                {formatSigned(effectivePortfolioSummary?.cagr ?? Number.NaN, 2, '%')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Max DD % ({formatDrawdownModeLabel(effectiveDrawdownMode)}, {formatDrawdownSourceLabel(effectivePortfolioDrawdownSource)})
              </Typography>
              <Typography variant="h6">
                {formatSigned(effectivePortfolioSummary?.maxDrawdown ?? Number.NaN, 2, '%')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                MAR ratio
              </Typography>
              <Typography variant="h6">
                {formatSigned(effectivePortfolioSummary?.mar ?? Number.NaN, 2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Sharpe
              </Typography>
              <Typography variant="h6">
                {formatSigned(effectivePortfolioSummary?.sharpe ?? Number.NaN, 2)}
              </Typography>
            </Box>
          </Stack>
          {effectivePortfolioSummary?.regression && (
            <Box>
              <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
                Portfolio regression (n={effectivePortfolioSummary.regression.n})
              </Typography>
              <Typography variant="body1" color="text.primary">
                alpha_ann={formatSigned(effectivePortfolioSummary.regression.alphaAnn, 2, '%/yr')}; betas:{' '}
                {effectivePortfolioSummary.regression.betas
                  .map((item) => `${item.symbol}: ${formatSigned(item.beta, 2)}`)
                  .join(', ')}
              </Typography>
              <Typography variant="body1" color="text.primary">
                R²={formatSigned(effectivePortfolioSummary.regression.r2, 3)}
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
              Status counts
            </Typography>
            <Typography variant="body1" color="text.primary">
              GREEN={riskRows.filter((row) => row.status === 'GREEN').length}, YELLOW=
              {riskRows.filter((row) => row.status === 'YELLOW').length}, RED=
              {riskRows.filter((row) => row.status === 'RED').length}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
              Portfolio DD shock flag
            </Typography>
            <Typography variant="body1" color="text.primary">
              {computeDdShock(effectivePortfolioDrawdown).flag}
            </Typography>
          </Box>
        </Stack>
      </Paper>
      <Dialog open={sleeveDialogOpen} onClose={() => setSleeveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change portfolio composition</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Button
              size="small"
              onClick={() => setSleeveDraft(new Set(sleeveLabels))}
              disabled={sleeveDraft.size === sleeveLabels.length}
            >
              Select all
            </Button>
            <Button size="small" onClick={() => setSleeveDraft(new Set())}>
              Clear
            </Button>
            <Button size="small" onClick={resetSleeveWeightDraft}>
              Reset weights
            </Button>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              label="All sleeves weight"
              size="small"
              value={globalWeightDraft}
              onChange={(event) => updateGlobalWeightDraft(event.target.value)}
              inputProps={{ inputMode: 'decimal', step: 0.01 }}
              sx={{ width: 220 }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={applyGlobalWeightDraft}
              disabled={globalWeightDraft === ''}
            >
              Apply to all
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {sleeveLabels.map((label) => (
              <Stack key={label} direction="row" spacing={1.5} alignItems="center">
                <FormControlLabel
                  sx={{ m: 0, flex: 1 }}
                  control={
                    <Checkbox
                      checked={sleeveDraft.has(label)}
                      onChange={() => toggleSleeveDraft(label)}
                    />
                  }
                  label={label}
                />
                <TextField
                  label="Weight"
                  size="small"
                  value={sleeveWeightDraft[label] ?? ''}
                  onChange={(event) => updateSleeveWeightDraft(label, event.target.value)}
                  inputProps={{ inputMode: 'decimal', step: 0.01 }}
                  sx={{ width: 120 }}
                />
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setSleeveDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={applySleeveSelection} disabled={isApplyDisabled}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default PortfolioTab
