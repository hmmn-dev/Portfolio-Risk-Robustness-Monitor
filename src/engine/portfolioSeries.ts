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

const getSymbol = (deal: DealRow) => {
  if (deal.symbol && deal.symbol.trim()) return deal.symbol.trim()
  const parts = deal.sleeve.includes(' — ')
    ? deal.sleeve.split(' — ')
    : deal.sleeve.split(' - ')
  if (parts.length > 1) return parts[parts.length - 1].trim()
  return 'UNSPECIFIED'
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

const toDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const toHourStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours()
  )
}

const buildDrawdownFromEquity = (series: { time: number; equity: number }[]) => {
  let maxEquity = Number.NaN
  return series.map((point) => {
    const equity = point.equity
    if (Number.isFinite(equity)) {
      maxEquity = Number.isFinite(maxEquity) ? Math.max(maxEquity, equity) : equity
    }
    const value =
      Number.isFinite(equity) && Number.isFinite(maxEquity) && maxEquity > 0
        ? (equity / maxEquity - 1) * 100
        : Number.NaN
    return { time: point.time, value }
  })
}

type OpenPosition = {
  key: string
  symbol: string
  direction: 1 | -1
  volume: number
  avgEntryPrice: number
}

type MtmDrawdownResult = {
  drawdown: DailyPoint[]
  source?: 'H1' | 'D1'
  drawdownBySleeve: Map<SleeveKey, DailyPoint[]>
}

const getPositionKey = (deal: DealRow, symbol: string) => {
  if (Number.isFinite(deal.positionId ?? NaN) && (deal.positionId ?? 0) !== 0) {
    return `${symbol}::pid::${deal.positionId as number}`
  }
  if (Number.isFinite(deal.magic ?? NaN) && (deal.magic ?? 0) !== 0) {
    return `${symbol}::magic::${deal.magic as number}`
  }
  return `${symbol}::deal::${deal.deal}`
}

const buildMtmDrawdown = (
  deals: DealRow[],
  underlyingSeries: UnderlyingSeries[],
  startCapital: number
): MtmDrawdownResult | null => {
  if (!underlyingSeries.length) return null

  const candlesByTime = new Map<number, { symbol: string; close: number }[]>()
  let source: 'H1' | 'D1' | undefined
  const sleeves = new Set<SleeveKey>()
  deals.forEach((deal) => {
    if (deal.sleeve) sleeves.add(deal.sleeve)
  })

  underlyingSeries.forEach((series) => {
    const symbol = normalizeSymbol(series.symbol)
    if (!symbol) return
    if (series.timeframe === 'H1') {
      source = 'H1'
    } else if (!source) {
      source = 'D1'
    }
    series.candles.forEach((candle) => {
      if (!Number.isFinite(candle.close)) return
      const list = candlesByTime.get(candle.time) ?? []
      list.push({ symbol, close: candle.close })
      candlesByTime.set(candle.time, list)
    })
  })

  if (!source || candlesByTime.size === 0) return null

  const candleTimes = stableSort(Array.from(candlesByTime.keys()), (a, b) => a - b)
  const firstDealTime = deals.find((deal) => Number.isFinite(deal.time))?.time
  const startTime = Number.isFinite(firstDealTime ?? NaN)
    ? source === 'H1'
      ? toHourStart(firstDealTime as number)
      : toDayStart(firstDealTime as number)
    : Number.NaN
  const activeCandleTimes = Number.isFinite(startTime)
    ? candleTimes.filter((time) => time >= (startTime as number))
    : candleTimes
  const latestPriceBySymbol = new Map<string, number>()
  const pointValueBySymbol = new Map<string, number>()
  const positions = new Map<string, OpenPosition>()
  const equitySeries: { time: number; equity: number }[] = []
  const positionsBySleeve = new Map<SleeveKey, Map<string, OpenPosition>>()
  const balanceBySleeve = new Map<SleeveKey, number>()
  const sleeveEquitySeries = new Map<SleeveKey, { time: number; equity: number }[]>()
  let balance = startCapital
  let dealIndex = 0

  sleeves.forEach((sleeve) => {
    balanceBySleeve.set(sleeve, startCapital)
    positionsBySleeve.set(sleeve, new Map())
    sleeveEquitySeries.set(sleeve, [])
  })

  for (const time of activeCandleTimes) {
    while (dealIndex < deals.length && deals[dealIndex].time <= time) {
      const deal = deals[dealIndex]
      dealIndex += 1
      if (!Number.isFinite(deal.time)) continue

      balance += deal.notional
      if (deal.sleeve) {
        const sleeveBalance = balanceBySleeve.get(deal.sleeve) ?? startCapital
        balanceBySleeve.set(deal.sleeve, sleeveBalance + deal.notional)
      }
      const symbol = normalizeSymbol(deal.symbol ?? '')
      if (!symbol) continue
      const entryType = deal.entryType
      if (!entryType || entryType === 'unknown') continue
      if (!Number.isFinite(deal.price ?? NaN) || !Number.isFinite(deal.volume ?? NaN)) {
        continue
      }
      const price = deal.price as number
      const volume = deal.volume as number
      if (volume <= 0) continue
      if (price <= 0) continue

      const positionKey = getPositionKey(deal, symbol)
      if (entryType === 'in') {
        if (!deal.side) continue
        const direction: 1 | -1 = deal.side === 'buy' ? 1 : -1
        const existing = positions.get(positionKey)
        const sleevePositions = deal.sleeve ? positionsBySleeve.get(deal.sleeve) : undefined
        const sleeveExisting = sleevePositions?.get(positionKey)
        if (!existing) {
          positions.set(positionKey, {
            key: positionKey,
            symbol,
            direction,
            volume,
            avgEntryPrice: price,
          })
          if (sleevePositions) {
            sleevePositions.set(positionKey, {
              key: positionKey,
              symbol,
              direction,
              volume,
              avgEntryPrice: price,
            })
          }
        } else if (existing.direction !== direction && existing.volume > 0) {
          positions.set(positionKey, {
            key: positionKey,
            symbol,
            direction,
            volume,
            avgEntryPrice: price,
          })
          if (sleevePositions) {
            sleevePositions.set(positionKey, {
              key: positionKey,
              symbol,
              direction,
              volume,
              avgEntryPrice: price,
            })
          }
        } else {
          const totalVolume = existing.volume + volume
          const avgEntryPrice =
            totalVolume > 0
              ? (existing.avgEntryPrice * existing.volume + price * volume) / totalVolume
              : existing.avgEntryPrice
          positions.set(positionKey, {
            ...existing,
            volume: totalVolume,
            avgEntryPrice,
          })
          if (sleevePositions) {
            const sleeveBase = sleeveExisting ?? existing
            const sleeveTotal = sleeveBase.volume + volume
            const sleeveAvg =
              sleeveTotal > 0
                ? (sleeveBase.avgEntryPrice * sleeveBase.volume + price * volume) / sleeveTotal
                : sleeveBase.avgEntryPrice
            sleevePositions.set(positionKey, {
              ...sleeveBase,
              volume: sleeveTotal,
              avgEntryPrice: sleeveAvg,
            })
          }
        }
      } else {
        const existing = positions.get(positionKey)
        const sleevePositions = deal.sleeve ? positionsBySleeve.get(deal.sleeve) : undefined
        const sleeveExisting = sleevePositions?.get(positionKey)
        if (!existing) continue
        const closeVolume = Math.min(volume, existing.volume)
        const priceDiff = (price - existing.avgEntryPrice) * existing.direction
        if (
          Number.isFinite(priceDiff) &&
          priceDiff !== 0 &&
          closeVolume > 0 &&
          Number.isFinite(deal.profit ?? NaN)
        ) {
          const pointValue = Math.abs((deal.profit as number) / (priceDiff * closeVolume))
          if (Number.isFinite(pointValue) && pointValue > 0) {
            const prior = pointValueBySymbol.get(symbol)
            pointValueBySymbol.set(symbol, prior ? (prior + pointValue) / 2 : pointValue)
          }
        }
        const remaining = existing.volume - closeVolume
        if (remaining <= 0) {
          positions.delete(positionKey)
        } else {
          positions.set(positionKey, { ...existing, volume: remaining })
        }
        if (sleeveExisting && sleevePositions) {
          const sleeveRemaining = sleeveExisting.volume - Math.min(volume, sleeveExisting.volume)
          if (sleeveRemaining <= 0) {
            sleevePositions.delete(positionKey)
          } else {
            sleevePositions.set(positionKey, { ...sleeveExisting, volume: sleeveRemaining })
          }
        }
      }
    }

    const candleUpdates = candlesByTime.get(time) ?? []
    candleUpdates.forEach((update) => {
      latestPriceBySymbol.set(update.symbol, update.close)
    })

    let openPnl = 0
    positions.forEach((position) => {
      const price = latestPriceBySymbol.get(position.symbol)
      const pointValue = pointValueBySymbol.get(position.symbol)
      if (!Number.isFinite(price ?? NaN) || !Number.isFinite(pointValue ?? NaN)) return
      openPnl +=
        (price as number - position.avgEntryPrice) *
        position.direction *
        position.volume *
        (pointValue as number)
    })

    equitySeries.push({ time, equity: balance + openPnl })

    sleeves.forEach((sleeve) => {
      const sleevePositions = positionsBySleeve.get(sleeve)
      if (!sleevePositions) return
      let sleeveOpenPnl = 0
      sleevePositions.forEach((position) => {
        const price = latestPriceBySymbol.get(position.symbol)
        const pointValue = pointValueBySymbol.get(position.symbol)
        if (!Number.isFinite(price ?? NaN) || !Number.isFinite(pointValue ?? NaN)) return
        sleeveOpenPnl +=
          (price as number - position.avgEntryPrice) *
          position.direction *
          position.volume *
          (pointValue as number)
      })
      const sleeveBalance = balanceBySleeve.get(sleeve) ?? startCapital
      const equity = sleeveBalance + sleeveOpenPnl
      sleeveEquitySeries.get(sleeve)?.push({ time, equity })
    })
  }

  if (equitySeries.length === 0) return null
  const drawdownBySleeve = new Map<SleeveKey, DailyPoint[]>()
  sleeves.forEach((sleeve) => {
    const series = sleeveEquitySeries.get(sleeve) ?? []
    if (series.length === 0) {
      drawdownBySleeve.set(sleeve, [])
      return
    }
    const returns = series.map((point, idx) => {
      const prevEquity = idx === 0 ? Number.NaN : series[idx - 1].equity
      const prevPortfolioEquity = idx === 0 ? Number.NaN : equitySeries[idx - 1]?.equity
      const pnl =
        Number.isFinite(prevEquity) && Number.isFinite(point.equity)
          ? point.equity - prevEquity
          : Number.NaN
      const value =
        Number.isFinite(prevPortfolioEquity) && prevPortfolioEquity > 0
          ? pnl / (prevPortfolioEquity as number)
          : Number.NaN
      return { time: point.time, value }
    })
    drawdownBySleeve.set(sleeve, buildIndexAndDrawdown(returns).drawdown)
  })
  return {
    drawdown: buildDrawdownFromEquity(equitySeries),
    source,
    drawdownBySleeve,
  }
}

export const buildPortfolioReport = (
  deals: DealRow[],
  options: PortfolioReportOptions = {}
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
    const dailyReturn =
      Number.isFinite(denom) && denom > 0 ? pnl / (denom as number) : Number.NaN

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
      const prevEquity = index === 0 ? Number.NaN : portfolioHourSeries[index - 1].equity
      let equity = 0
      if (hasBalance) {
        const lastBalance = balanceByHour.get(time)
        if (Number.isFinite(lastBalance ?? NaN)) {
          equity = lastBalance as number
        } else if (Number.isFinite(prevEquity)) {
          equity = prevEquity
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
  const mtmResult = buildMtmDrawdown(
    sortedDeals,
    options.underlyingSeries ?? [],
    startCapital
  )

  const contributionMap = new Map<
    string,
    { sleeve: SleeveKey; symbol: string; pnlByDay: Map<number, number>; pnlByHour: Map<number, number> }
  >()
  sortedDeals.forEach((deal) => {
    const symbol = getSymbol(deal)
    const key = `${deal.sleeve}::${symbol}`
    if (!contributionMap.has(key)) {
      contributionMap.set(key, { sleeve: deal.sleeve, symbol, pnlByDay: new Map(), pnlByHour: new Map() })
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
    a.localeCompare(b)
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

    const returns = days.map((time, idx) => {
      const denom = idx === 0 ? Number.NaN : portfolioDays[idx - 1].equity
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
          hours.map((time, idx) => {
            const denom = idx === 0 ? Number.NaN : portfolioHourSeries[idx - 1].equity
            const value =
              Number.isFinite(denom) && denom > 0
                ? (entry.pnlByHour.get(time) ?? 0) / (denom as number)
                : Number.NaN
            return { time, value }
          })
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
