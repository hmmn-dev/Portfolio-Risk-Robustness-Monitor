import { correlation } from '../../../engine/correlation'
import { buildIndexAndDrawdown } from '../../../engine/portfolioSeriesHelpers'
import { stableSort } from '../../../engine/stableSort'
import type { DailyPoint, ReportModel } from '../../../engine/types'
import { computeSharpe, getSeriesValues } from '../helpers/series'
import type { CorrelationMatrix, PortfolioSummary } from '../types'

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export type MonthlyReturnRow = {
  year: number
  months: (number | null)[]
  total: number | null
  maxDrawdown: number | null
}

export type CustomPortfolioSeries = {
  index: DailyPoint[]
  drawdown: DailyPoint[]
  returns: number[]
}

export { buildIndexAndDrawdown }

export const buildMonthlyReturnRows = (
  dailyReturns: DailyPoint[],
  drawdown: DailyPoint[],
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

  const drawdownByYear = new Map<number, number>()
  drawdown.forEach((point) => {
    if (!Number.isFinite(point.value)) return
    const date = new Date(point.time)
    if (Number.isNaN(date.getTime())) return
    const year = date.getUTCFullYear()
    const current = drawdownByYear.get(year)
    if (!Number.isFinite(current ?? NaN) || point.value < (current as number)) {
      drawdownByYear.set(year, point.value)
    }
  })

  return stableSort(Array.from(yearMap.keys()), (a, b) => a - b).map((year) => {
    const entry = yearMap.get(year) as { months: (number | null)[]; yearProduct: number | null }
    return {
      year,
      months: entry.months.map((product) => (product == null ? null : product - 1)),
      total: entry.yearProduct == null ? null : entry.yearProduct - 1,
      maxDrawdown: drawdownByYear.get(year) ?? null,
    }
  })
}

export const buildWeightedPortfolio = (
  portfolioDays: ReportModel['portfolio']['days'],
  contributions: ReportModel['contributions'],
  weights: Record<string, number>,
): CustomPortfolioSeries => {
  const returnMaps = new Map<string, Map<number, number>>()
  contributions.forEach((item) => {
    returnMaps.set(
      item.sleeve,
      new Map(
        item.returns.map((point) => [point.time, Number.isFinite(point.value) ? point.value : 0]),
      ),
    )
  })
  const dailyReturns = portfolioDays.map(({ time }) => {
    const value = contributions.reduce((total, item) => {
      const contributionReturn = returnMaps.get(item.sleeve)?.get(time)
      return Number.isFinite(contributionReturn ?? NaN)
        ? total + (contributionReturn as number) * (weights[item.sleeve] ?? 1)
        : total
    }, 0)
    return { time, value }
  })
  const { index, drawdown } = buildIndexAndDrawdown(dailyReturns)
  return { index, drawdown, returns: dailyReturns.map((point) => point.value) }
}

export const buildCustomPortfolioSummary = (
  portfolio: CustomPortfolioSeries | null,
): PortfolioSummary => {
  if (!portfolio?.index.length) {
    return {
      totalReturnPct: Number.NaN,
      cagr: Number.NaN,
      maxDrawdown: Number.NaN,
      mar: Number.NaN,
      sharpe: Number.NaN,
      regression: null,
    }
  }
  const first = portfolio.index[0]
  const last = portfolio.index.at(-1) as DailyPoint
  const years = (last.time - first.time) / (365.25 * 24 * 60 * 60 * 1000)
  const cagr =
    first.value > 0 && last.value > 0 && Number.isFinite(years) && years > 0
      ? (Math.pow(last.value / first.value, 1 / years) - 1) * 100
      : Number.NaN
  const maxDrawdown = portfolio.drawdown.reduce(
    (minimum, point) => (point.value < minimum ? point.value : minimum),
    0,
  )

  return {
    totalReturnPct: (last.value - 1) * 100,
    cagr,
    maxDrawdown,
    mar: maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : Number.NaN,
    sharpe: computeSharpe(portfolio.returns),
    regression: null,
  }
}

const safeCorrelation = (seriesA: number[], seriesB: number[]) => {
  const pairs: [number, number][] = []
  const length = Math.min(seriesA.length, seriesB.length)
  for (let index = 0; index < length; index += 1) {
    if (Number.isFinite(seriesA[index]) && Number.isFinite(seriesB[index])) {
      pairs.push([seriesA[index], seriesB[index]])
    }
  }
  if (pairs.length < 2) return null
  const value = correlation(
    pairs.map(([a]) => a),
    pairs.map(([, b]) => b),
  )
  return Number.isFinite(value) ? value : null
}

export const buildContributionCorrelationMatrix = (
  contributions: ReportModel['contributions'],
): CorrelationMatrix => {
  const labels = stableSort(
    contributions.map((item) => item.sleeve),
    (a, b) => a.localeCompare(b),
  )
  const returnsBySleeve = new Map(
    contributions.map((item) => [item.sleeve, getSeriesValues(item.returns)]),
  )
  return {
    labels,
    values: labels.map((a) =>
      labels.map((b) =>
        safeCorrelation(returnsBySleeve.get(a) ?? [], returnsBySleeve.get(b) ?? []),
      ),
    ),
  }
}

export const applyDrawdownToSummary = (
  summary: PortfolioSummary | null,
  drawdown: DailyPoint[],
) => {
  if (!summary) return null
  const maxDrawdown = drawdown.reduce(
    (minimum, point) => (point.value < minimum ? point.value : minimum),
    0,
  )
  return {
    ...summary,
    maxDrawdown,
    mar:
      maxDrawdown < 0 && Number.isFinite(summary.cagr)
        ? summary.cagr / Math.abs(maxDrawdown)
        : Number.NaN,
  }
}

export const buildDailyReturnPoints = (
  days: ReportModel['portfolio']['days'],
  customReturns?: number[],
) =>
  days.map((day, index) => ({
    time: day.time,
    value: customReturns ? (customReturns[index] ?? Number.NaN) : day.return,
  }))
