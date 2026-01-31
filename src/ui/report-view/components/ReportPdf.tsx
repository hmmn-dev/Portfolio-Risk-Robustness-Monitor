import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { computeDdShock } from '../../../engine/ddShock'
import { stableSort } from '../../../engine/stableSort'
import type { DailyPoint } from '../../../engine/types'
import { DrawdownChart, EquityChart } from '../charts'
import { correlationColor, isLightColor } from '../colors'
import {
  formatDrawdownModeLabel,
  formatDrawdownSourceLabel,
  formatSigned,
} from '../formatters'
import PdfPage from './PdfPage'
import PdfTable from './PdfTable'
import SleeveSectionPrint from './SleeveSectionPrint'
import { useReportViewContext } from './ReportViewContext'

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type MonthlyReturnRow = {
  year: number
  months: (number | null)[]
  total: number | null
  maxDrawdown: number | null
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
  } = useReportViewContext()
  const dailyReturns: DailyPoint[] = report.portfolio.days.map((day) => ({
    time: day.time,
    value: day.return,
  }))
  const monthlyReturns = buildMonthlyReturnRows(dailyReturns, portfolioDrawdown)
  const heatCellColor = (value: number | null) => {
    if (!Number.isFinite(value ?? NaN)) return lightTheme.palette.action.hover
    const abs = Math.abs(value as number)
    const level = abs >= 0.1 ? 2 : abs >= 0.03 ? 1 : 0
    const positive = (value as number) >= 0
    if (positive) {
      return level === 2
        ? lightTheme.palette.success.dark
        : level === 1
          ? lightTheme.palette.success.main
          : lightTheme.palette.success.light
    }
    return level === 2
      ? lightTheme.palette.error.dark
      : level === 1
        ? lightTheme.palette.error.main
        : lightTheme.palette.error.light
  }

  return (
    <>
      <PdfPage
        title="Performance table"
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
      >
        <PdfTable title="Performance" columns={pdfPerformanceColumns} rows={pdfPerformanceRows} />
      </PdfPage>
      <PdfPage
        title="Risk / decay table"
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
      >
        <PdfTable title="Risk / decay" columns={pdfRiskColumns} rows={pdfRiskRows} />
      </PdfPage>
      {report.contributions.map((item) => {
        const metrics = buildSleeveMetrics(item)
        if (!metrics) return null
        return (
          <PdfPage
            key={item.sleeve}
            title={`Sleeve: ${formatPdfSleeveLabel(item.sleeve)}`}
            pdfName={pdfName}
            width={pdfPageWidth}
            minHeight={pdfPageMinHeight}
          >
            <SleeveSectionPrint
              item={item}
              metrics={metrics}
              baseCapital={baseCapital}
              drawdownSeries={getSleeveDrawdown(item)}
              drawdownSource={getSleeveDrawdownSource(item)}
              pnlScaleMode={pnlScaleMode}
              pnlColor={printPnlColor}
              axisColor={printAxisColor}
              gridColor={printGridColor}
            />
          </PdfPage>
        )
      })}
      <PdfPage
        title="Portfolio equity & drawdown"
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">Portfolio equity</Typography>
              <EquityChart
                data={report.portfolio.index}
                scaleMode="percent"
                pnlScaleMode={pnlScaleMode}
                baseValue={baseCapital}
                drawdownSeries={portfolioDrawdown}
                height={280}
                minOffsetRatio={0}
                reserveGridlines={0}
                color={printPnlColor}
                axisColor={printAxisColor}
                gridColor={printGridColor}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2">
                Portfolio drawdown ({formatDrawdownSourceLabel(portfolioDrawdownSource)})
              </Typography>
              <DrawdownChart
                data={portfolioDrawdown}
                height={200}
                axisColor={printAxisColor}
                gridColor={printGridColor}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2">Drawdown shock</Typography>
              <Chip label={computeDdShock(portfolioDrawdown).flag} />
            </Box>
          </Stack>
        </Paper>
      </PdfPage>
      <PdfPage
        title="Portfolio monthly returns"
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Portfolio monthly returns</Typography>
              <Typography variant="caption" color="text.secondary">
                Values in percent
              </Typography>
            </Stack>
            <TableContainer component={Box}>
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
                          ? lightTheme.palette.text.primary
                          : lightTheme.palette.common.white
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
      </PdfPage>
      <PdfPage
        title="Portfolio correlation"
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2">Cross-sleeve correlation</Typography>
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `${pdfCorrelationCellSize}px repeat(${pdfCorrelationLabels.length}, ${pdfCorrelationCellSize}px)`,
                  gridAutoRows: `${pdfCorrelationCellSize}px`,
                  gap: 0,
                  alignItems: 'center',
                }}
              >
                <Box />
                {pdfCorrelationLabels.map((label, idx) => (
                  <Typography
                    key={label}
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      textAlign: 'center',
                      color: lightTheme.palette.text.secondary,
                      fontSize: 11,
                    }}
                  >
                    {idx + 1}
                  </Typography>
                ))}
                {pdfCorrelationLabels.map((label, rowIdx) => (
                  <Box key={label} sx={{ display: 'contents' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        textAlign: 'center',
                        color: lightTheme.palette.text.secondary,
                        fontSize: 11,
                      }}
                    >
                      {rowIdx + 1}
                    </Typography>
                    {correlationMatrix.values[rowIdx]?.map((value, colIdx) => {
                      const bg = correlationColor(value)
                      const text = value == null ? '-' : value.toFixed(2)
                      const isLarge = pdfCorrelationLabels.length > 12
                      const textColor = isLightColor(bg)
                        ? lightTheme.palette.common.black
                        : lightTheme.palette.common.white
                      return (
                        <Box
                          key={`${label}-${colIdx}`}
                          sx={{
                            width: pdfCorrelationCellSize,
                            height: pdfCorrelationCellSize,
                            textAlign: 'center',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 0,
                            backgroundColor: bg,
                            color: textColor,
                            fontSize: showCorrNumbers ? (isLarge ? 9 : 11) : 0,
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 0.5,
                width: '100%',
              }}
            >
              {pdfCorrelationLabels.map((label, idx) => (
                <Typography
                  key={label}
                  variant="body2"
                  sx={{ color: lightTheme.palette.text.primary, fontWeight: 600 }}
                >
                  {idx + 1}. {label}
                </Typography>
              ))}
            </Box>
          </Box>
        </Paper>
      </PdfPage>
      <PdfPage
        title="Portfolio summary"
        pdfName={pdfName}
        width={pdfPageWidth}
        minHeight={pdfPageMinHeight}
      >
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Portfolio summary
            </Typography>
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  PnL %
                </Typography>
                <Typography variant="h6">
                  {formatSigned(portfolioSummary?.totalReturnPct ?? Number.NaN, 2, '%')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  CAGR %
                </Typography>
                <Typography variant="h6">
                  {formatSigned(portfolioSummary?.cagr ?? Number.NaN, 2, '%')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Max DD % ({formatDrawdownModeLabel(drawdownMode)},{' '}
                  {formatDrawdownSourceLabel(portfolioDrawdownSource)})
                </Typography>
                <Typography variant="h6">
                  {formatSigned(portfolioSummary?.maxDrawdown ?? Number.NaN, 2, '%')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  MAR ratio
                </Typography>
                <Typography variant="h6">
                  {formatSigned(portfolioSummary?.mar ?? Number.NaN, 2)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Sharpe
                </Typography>
                <Typography variant="h6">
                  {formatSigned(portfolioSummary?.sharpe ?? Number.NaN, 2)}
                </Typography>
              </Box>
            </Stack>
            {portfolioSummary?.regression && (
              <Box>
                <Typography variant="h6" sx={{ mb: 0.75, fontWeight: 600 }}>
                  Portfolio regression (n={portfolioSummary.regression.n})
                </Typography>
                <Typography variant="body1" color="text.primary">
                  alpha_ann={formatSigned(portfolioSummary.regression.alphaAnn, 2, '%/yr')}; betas:{' '}
                  {portfolioSummary.regression.betas
                    .map((item) => `${formatPdfSymbol(item.symbol)}: ${formatSigned(item.beta, 2)}`)
                    .join(', ')}
                </Typography>
                <Typography variant="body1" color="text.primary">
                  R^2={formatSigned(portfolioSummary.regression.r2, 3)}
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
                {computeDdShock(portfolioDrawdown).flag}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </PdfPage>
    </>
  )
}

export default ReportPdf
