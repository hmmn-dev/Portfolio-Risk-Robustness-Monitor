import { buildMtmDrawdown } from './mtmDrawdown'
import {
  buildDrawdownFromEquity,
  buildIndexAndDrawdown,
  getDealSymbol,
  toDayStart,
  toHourStart,
} from './portfolioSeriesHelpers'
import { stableSort } from './stableSort'
import { normalizeSymbol } from './underlying'
import type {
  ContributionSeries,
  DailyPoint,
  DealRow,
  ReportModel,
  SleeveKey,
  UnderlyingSeries,
} from './types'

type PortfolioReportOptions = {
  initialCapital?: number
  generatedAt?: number
  dealsSourceName?: string
  underlyingTimeframes?: Record<string, 'H1' | 'D1'>
  underlyingSeries?: UnderlyingSeries[]
}

export const buildPortfolioReport = (
  deals: DealRow[],
  options: PortfolioReportOptions = {},
): ReportModel => {
  const normalizedTimeframes = new Map<string, 'H1' | 'D1'>()
  Object.entries(options.underlyingTimeframes ?? {}).forEach(([symbol, timeframe]) => {
    normalizedTimeframes.set(normalizeSymbol(symbol), timeframe)
  })
  const getTimeframeForSymbol = (symbol: string) =>
    normalizedTimeframes.get(normalizeSymbol(symbol))
  const portfolioDrawdownSource = (() => {
    for (const timeframe of normalizedTimeframes.values()) {
      if (timeframe === 'H1') return 'H1'
    }
    for (const timeframe of normalizedTimeframes.values()) {
      if (timeframe === 'D1') return 'D1'
    }
    return undefined
  })()

  const sortedDeals = stableSort(deals, (a, b) => {
    const byTime = a.time - b.time
    if (byTime) return byTime
    return a.deal.localeCompare(b.deal)
  })

  const daySet = new Set<number>()
  const pnlByDay = new Map<number, number>()
  const hourSet = new Set<number>()
  const pnlByHour = new Map<number, number>()
  sortedDeals.forEach((deal) => {
    const day = toDayStart(deal.time)
    daySet.add(day)
    pnlByDay.set(day, (pnlByDay.get(day) ?? 0) + deal.notional)
    const hour = toHourStart(deal.time)
    hourSet.add(hour)
    pnlByHour.set(hour, (pnlByHour.get(hour) ?? 0) + deal.notional)
  })

  const days = stableSort(Array.from(daySet), (a, b) => a - b)
  const hours = stableSort(Array.from(hourSet), (a, b) => a - b)
  const hasBalance = sortedDeals.some((deal) => Number.isFinite(deal.balance ?? NaN))
  const balanceByDay = new Map<number, number>()
  const balanceByHour = new Map<number, number>()

  if (hasBalance) {
    sortedDeals.forEach((deal) => {
      if (Number.isFinite(deal.balance ?? NaN)) {
        const day = toDayStart(deal.time)
        balanceByDay.set(day, deal.balance as number)
        const hour = toHourStart(deal.time)
        balanceByHour.set(hour, deal.balance as number)
      }
    })
  }

  const dailyReturns: DailyPoint[] = []
  const portfolioDays: ReportModel['portfolio']['days'] = []
  const firstBalance = sortedDeals.find((deal) => Number.isFinite(deal.balance ?? NaN))?.balance
  const startCapital =
    options.initialCapital ??
    (Number.isFinite(firstBalance ?? NaN) ? (firstBalance as number) : 10000)

  const baseCapitalBySleeve = new Map<SleeveKey, number>()
  sortedDeals.forEach((deal) => {
    if (baseCapitalBySleeve.has(deal.sleeve)) return
    if (Number.isFinite(deal.balance ?? NaN)) {
      baseCapitalBySleeve.set(deal.sleeve, deal.balance as number)
    }
  })

  for (let index = 0; index < days.length; index += 1) {
    const time = days[index]
    const pnlFromDeals = pnlByDay.get(time) ?? 0
    const previousEquity = index === 0 ? Number.NaN : portfolioDays[index - 1].equity
    let equity = 0

    if (hasBalance) {
      const lastBalance = balanceByDay.get(time)
      if (Number.isFinite(lastBalance ?? NaN)) {
        equity = lastBalance as number
      } else if (Number.isFinite(previousEquity)) {
        equity = previousEquity
      } else {
        equity = Number.NaN
      }
    } else {
      const priorEquity = index === 0 ? startCapital : portfolioDays[index - 1].equity
      equity = priorEquity + pnlFromDeals
    }

    const pnl =
      hasBalance && Number.isFinite(previousEquity) && Number.isFinite(equity)
        ? equity - (previousEquity as number)
        : pnlFromDeals
    const denom = index === 0 ? Number.NaN : portfolioDays[index - 1].equity
    const dailyReturn = Number.isFinite(denom) && denom > 0 ? pnl / (denom as number) : Number.NaN

    dailyReturns.push({ time, value: dailyReturn })
    portfolioDays.push({
      time,
      pnl,
      equity,
      denom,
      return: dailyReturn,
    })
  }

  const portfolioIndex = buildIndexAndDrawdown(dailyReturns)
  const useHourlyDrawdown = portfolioDrawdownSource === 'H1'
  const portfolioHourSeries: { time: number; equity: number; pnl: number }[] = []
  if (useHourlyDrawdown) {
    hours.forEach((time, index) => {
      const pnl = pnlByHour.get(time) ?? 0
      const previousEquity = index === 0 ? Number.NaN : portfolioHourSeries[index - 1].equity
      let equity: number;
      if (hasBalance) {
        const lastBalance = balanceByHour.get(time)
        if (Number.isFinite(lastBalance ?? NaN)) {
          equity = lastBalance as number
        } else if (Number.isFinite(previousEquity)) {
          equity = previousEquity
        } else {
          equity = Number.NaN
        }
      } else {
        const priorEquity = index === 0 ? startCapital : portfolioHourSeries[index - 1].equity
        equity = priorEquity + pnl
      }
      portfolioHourSeries.push({ time, equity, pnl })
    })
  }
  const portfolioDrawdown = useHourlyDrawdown
    ? buildDrawdownFromEquity(portfolioHourSeries)
    : portfolioIndex.drawdown
  const mtmResult = buildMtmDrawdown(sortedDeals, options.underlyingSeries ?? [], startCapital)

  const contributionMap = new Map<
    string,
    {
      sleeve: SleeveKey
      symbol: string
      pnlByDay: Map<number, number>
      pnlByHour: Map<number, number>
    }
  >()
  sortedDeals.forEach((deal) => {
    const symbol = getDealSymbol(deal)
    const key = `${deal.sleeve}::${symbol}`
    if (!contributionMap.has(key)) {
      contributionMap.set(key, {
        sleeve: deal.sleeve,
        symbol,
        pnlByDay: new Map(),
        pnlByHour: new Map(),
      })
    }
    const entry = contributionMap.get(key) as {
      sleeve: SleeveKey
      symbol: string
      pnlByDay: Map<number, number>
      pnlByHour: Map<number, number>
    }
    const day = toDayStart(deal.time)
    entry.pnlByDay.set(day, (entry.pnlByDay.get(day) ?? 0) + deal.notional)
    const hour = toHourStart(deal.time)
    entry.pnlByHour.set(hour, (entry.pnlByHour.get(hour) ?? 0) + deal.notional)
  })

  const contributionKeys = stableSort(Array.from(contributionMap.keys()), (a, b) =>
    a.localeCompare(b),
  )

  const contributions: ContributionSeries[] = contributionKeys.map((key) => {
    const entry = contributionMap.get(key)
    if (!entry) {
      return {
        key,
        sleeve: key,
        symbol: 'UNSPECIFIED',
        pnl: [],
        returns: [],
        index: [],
        drawdown: [],
      }
    }

    const pnlSeries = days.map((time) => ({
      time,
      value: entry.pnlByDay.get(time) ?? 0,
    }))

    const returns = days.map((time, index) => {
      const denom = index === 0 ? Number.NaN : portfolioDays[index - 1].equity
      const value =
        Number.isFinite(denom) && denom > 0
          ? (entry.pnlByDay.get(time) ?? 0) / (denom as number)
          : Number.NaN
      return { time, value }
    })

    const dailySeries = buildIndexAndDrawdown(returns)
    const drawdownSource = getTimeframeForSymbol(entry.symbol)
    const useHourlyContribution =
      drawdownSource === 'H1' && useHourlyDrawdown && portfolioHourSeries.length > 0
    const drawdown = useHourlyContribution
      ? buildIndexAndDrawdown(
          hours.map((time, index) => {
            const denom = index === 0 ? Number.NaN : portfolioHourSeries[index - 1].equity
            const value =
              Number.isFinite(denom) && denom > 0
                ? (entry.pnlByHour.get(time) ?? 0) / (denom as number)
                : Number.NaN
            return { time, value }
          }),
        ).drawdown
      : dailySeries.drawdown

    const mtmDrawdown = mtmResult?.drawdownBySleeve.get(entry.sleeve)
    return {
      key,
      sleeve: entry.sleeve,
      symbol: entry.symbol,
      pnl: pnlSeries,
      returns,
      index: dailySeries.index,
      drawdown,
      drawdownSource,
      drawdownMtm: mtmDrawdown,
      drawdownMtmSource: mtmDrawdown ? mtmResult?.source : undefined,
      baseCapital: baseCapitalBySleeve.get(entry.sleeve),
    }
  })

  return {
    generatedAt: options.generatedAt ?? 0,
    dealsSourceName: options.dealsSourceName,
    portfolio: {
      days: portfolioDays,
      index: portfolioIndex.index,
      drawdown: portfolioDrawdown,
      drawdownSource: portfolioDrawdownSource,
      drawdownMtm: mtmResult?.drawdown,
      drawdownMtmSource: mtmResult?.source,
    },
    contributions,
  }
}
