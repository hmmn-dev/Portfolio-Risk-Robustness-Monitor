import { buildDrawdownFromEquity, toDayStart } from './portfolioSeriesHelpers'
import { stableSort } from './stableSort'
import type { DailyPoint, DealRow, PortfolioEquitySeries, PortfolioEquitySource } from './types'

export const buildPortfolioEquity = (
  observations: DailyPoint[],
  initialCapital: number,
  source: PortfolioEquitySource,
): PortfolioEquitySeries | undefined => {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0 || observations.length === 0) {
    return undefined
  }
  // Missing observations are not zero equity and must not be carried forward as a valuation.
  if (observations.some((point) => !Number.isFinite(point.time) || !Number.isFinite(point.value))) {
    return undefined
  }
  const sorted = stableSort(observations, (a, b) => a.time - b.time)
  const dailyEquity = new Map<number, number>()
  sorted.forEach((point) => dailyEquity.set(toDayStart(point.time), point.value))
  const dailyPoints = Array.from(dailyEquity, ([time, value]) => ({ time, value }))
  return {
    source,
    index: sorted.map((point) => ({ time: point.time, value: point.value / initialCapital })),
    dailyIndex: dailyPoints.map((point) => ({
      time: point.time,
      value: point.value / initialCapital,
    })),
    dailyReturns: dailyPoints.map((point, index) => {
      const previous = index === 0 ? initialCapital : dailyPoints[index - 1].value
      return { time: point.time, value: previous > 0 ? point.value / previous - 1 : Number.NaN }
    }),
    drawdown: buildDrawdownFromEquity(
      sorted.map((point) => ({ time: point.time, equity: point.value })),
      initialCapital,
    ),
  }
}

export const buildRecordedPortfolioEquity = (deals: DealRow[], initialCapital: number) => {
  // Account snapshots are ordered by export sequence, including multiple deals at one timestamp.
  const sorted = stableSort(deals, (a, b) => a.time - b.time || a._seq - b._seq)
  return buildPortfolioEquity(
    sorted.map((deal) => ({ time: deal.time, value: deal.equity ?? Number.NaN })),
    initialCapital,
    'deal-snapshots',
  )
}

// A common exposure multiplier needs no sleeve attribution: scale returns on the
// same account equity path, including floating PnL and its original coverage mask.
export const scalePortfolioEquityExposure = (
  baseline: PortfolioEquitySeries,
  multiplier: number,
): PortfolioEquitySeries | undefined => {
  if (!Number.isFinite(multiplier) || multiplier < 0 || baseline.index.length === 0) {
    return undefined
  }
  if (
    baseline.index.some((point) => !Number.isFinite(point.time) || !Number.isFinite(point.value))
  ) {
    return undefined
  }
  if (multiplier === 1) return baseline
  let previousBaseline = 1
  let equity = 1
  const observations: DailyPoint[] = []
  for (const point of baseline.index) {
    if (multiplier !== 0) {
      if (previousBaseline <= 0) return undefined
      equity *= 1 + multiplier * (point.value / previousBaseline - 1)
    }
    if (!Number.isFinite(equity)) return undefined
    observations.push({ time: point.time, value: equity })
    previousBaseline = point.value
  }
  const scaled = buildPortfolioEquity(observations, 1, baseline.source)
  if (scaled && baseline.recordedOnlyDrawdown) {
    const recordedTimes = new Set(baseline.recordedOnlyDrawdown.map((point) => point.time))
    scaled.recordedOnlyDrawdown = scaled.drawdown.filter((point) => recordedTimes.has(point.time))
  }
  return scaled
}
