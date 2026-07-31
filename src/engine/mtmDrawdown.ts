import {
  buildDrawdownFromEquity,
  buildIndexAndDrawdown,
  getDealSymbol,
  toDayStart,
  toHourStart,
} from './portfolioSeriesHelpers'
import { stableSort } from './stableSort'
import { normalizeSymbol } from './underlying'
import type { DailyPoint, DealRow, SleeveKey, UnderlyingSeries } from './types'

type OpenPosition = {
  key: string
  symbol: string
  direction: 1 | -1
  volume: number
  avgEntryPrice: number
}

export type MtmDrawdownResult = {
  drawdown: DailyPoint[]
  source?: 'H1' | 'D1'
  drawdownBySleeve: Map<SleeveKey, DailyPoint[]>
}

export type MtmDrawdownOptions = {
  sleeves?: ReadonlySet<SleeveKey>
  sleeveWeights?: Readonly<Record<SleeveKey, number>>
}

const getPositionKey = (deal: DealRow, symbol: string) => {
  const sleevePrefix = `${deal.sleeve}::${symbol}`
  if (Number.isFinite(deal.positionId ?? NaN) && (deal.positionId ?? 0) !== 0) {
    return `${sleevePrefix}::pid::${deal.positionId as number}`
  }
  if (Number.isFinite(deal.magic ?? NaN) && (deal.magic ?? 0) !== 0) {
    return `${sleevePrefix}::magic::${deal.magic as number}`
  }
  return `${sleevePrefix}::deal::${deal.deal}`
}

const resolveSleeveWeight = (
  sleeve: SleeveKey,
  sleeveWeights?: Readonly<Record<SleeveKey, number>>,
) => {
  const weight = sleeveWeights?.[sleeve]
  if (weight == null) return 1
  return Number.isFinite(weight) && weight >= 0 ? weight : 0
}

const upsertPosition = (
  positions: Map<string, OpenPosition>,
  key: string,
  symbol: string,
  direction: 1 | -1,
  volume: number,
  price: number,
) => {
  const existing = positions.get(key)
  if (!existing || existing.direction !== direction || existing.volume <= 0) {
    positions.set(key, {
      key,
      symbol,
      direction,
      volume,
      avgEntryPrice: price,
    })
    return
  }

  const totalVolume = existing.volume + volume
  positions.set(key, {
    ...existing,
    volume: totalVolume,
    avgEntryPrice: (existing.avgEntryPrice * existing.volume + price * volume) / totalVolume,
  })
}

const reducePosition = (positions: Map<string, OpenPosition>, key: string, volume: number) => {
  const existing = positions.get(key)
  if (!existing) return null
  const closeVolume = Math.min(volume, existing.volume)
  const remaining = existing.volume - closeVolume
  if (remaining <= 0) {
    positions.delete(key)
  } else {
    positions.set(key, { ...existing, volume: remaining })
  }
  return { position: existing, closeVolume }
}

const median = (values: number[]) => {
  const sorted = stableSort(
    values.filter((value) => Number.isFinite(value) && value > 0),
    (a, b) => a - b,
  )
  if (sorted.length === 0) return Number.NaN
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const inferPointValues = (deals: DealRow[]) => {
  const positions = new Map<string, OpenPosition>()
  const samplesByPosition = new Map<string, number[]>()
  const samplesBySymbol = new Map<string, number[]>()

  deals.forEach((deal) => {
    const symbol = normalizeSymbol(getDealSymbol(deal))
    if (!symbol || !deal.entryType || deal.entryType === 'unknown') return
    if (!Number.isFinite(deal.price ?? NaN) || !Number.isFinite(deal.volume ?? NaN)) return
    const price = deal.price as number
    const volume = deal.volume as number
    if (price <= 0 || volume <= 0) return
    const positionKey = getPositionKey(deal, symbol)

    if (deal.entryType === 'in') {
      if (!deal.side) return
      upsertPosition(positions, positionKey, symbol, deal.side === 'buy' ? 1 : -1, volume, price)
      return
    }

    const closed = reducePosition(positions, positionKey, volume)
    if (!closed || !Number.isFinite(deal.profit ?? NaN) || closed.closeVolume <= 0) return
    const priceDiff = (price - closed.position.avgEntryPrice) * closed.position.direction
    if (!Number.isFinite(priceDiff) || priceDiff === 0) return
    const pointValue = Math.abs((deal.profit as number) / (priceDiff * closed.closeVolume))
    if (!Number.isFinite(pointValue) || pointValue <= 0) return

    const positionSamples = samplesByPosition.get(positionKey) ?? []
    positionSamples.push(pointValue)
    samplesByPosition.set(positionKey, positionSamples)
    const symbolSamples = samplesBySymbol.get(symbol) ?? []
    symbolSamples.push(pointValue)
    samplesBySymbol.set(symbol, symbolSamples)
  })

  return {
    byPosition: new Map(
      Array.from(samplesByPosition, ([key, samples]) => [key, median(samples)] as const),
    ),
    bySymbol: new Map(
      Array.from(samplesBySymbol, ([symbol, samples]) => [symbol, median(samples)] as const),
    ),
  }
}

const buildWeightedMtmDrawdown = (
  equitySeries: { time: number; equity: number }[],
  sleeveEquitySeries: Map<SleeveKey, { time: number; equity: number }[]>,
  startCapital: number,
  sleeves: ReadonlySet<SleeveKey> | undefined,
  sleeveWeights: Readonly<Record<SleeveKey, number>> | undefined,
) => {
  const selectedSleeves = stableSort(Array.from(sleeves ?? sleeveEquitySeries.keys()), (a, b) =>
    a.localeCompare(b),
  )
  const returns = equitySeries.map((point, index) => {
    const previousPortfolioEquity = index === 0 ? startCapital : equitySeries[index - 1].equity
    const weightedPnl = selectedSleeves.reduce((total, sleeve) => {
      const series = sleeveEquitySeries.get(sleeve)
      const currentSleeveEquity = series?.[index]?.equity
      const previousSleeveEquity = index === 0 ? startCapital : series?.[index - 1]?.equity
      if (
        !Number.isFinite(currentSleeveEquity ?? NaN) ||
        !Number.isFinite(previousSleeveEquity ?? NaN)
      ) {
        return total
      }
      return (
        total +
        ((currentSleeveEquity as number) - (previousSleeveEquity as number)) *
          resolveSleeveWeight(sleeve, sleeveWeights)
      )
    }, 0)
    return {
      time: point.time,
      value:
        Number.isFinite(previousPortfolioEquity) && previousPortfolioEquity > 0
          ? weightedPnl / previousPortfolioEquity
          : Number.NaN,
    }
  })
  return buildIndexAndDrawdown(returns).drawdown
}

export const buildMtmDrawdown = (
  deals: DealRow[],
  underlyingSeries: UnderlyingSeries[],
  startCapital: number,
  options: MtmDrawdownOptions = {},
): MtmDrawdownResult | null => {
  if (!underlyingSeries.length || !Number.isFinite(startCapital) || startCapital <= 0) return null

  const sortedDeals = stableSort(
    deals.filter((deal) => Number.isFinite(deal.time)),
    (a, b) => {
      const byTime = a.time - b.time
      return byTime || a.deal.localeCompare(b.deal) || a._seq - b._seq
    },
  )
  if (sortedDeals.length === 0) return null

  const relevantSymbols = new Set(
    sortedDeals
      .map((deal) => normalizeSymbol(getDealSymbol(deal)))
      .filter((symbol) => symbol.length > 0 && symbol !== 'UNSPECIFIED'),
  )
  const relevantUnderlying = underlyingSeries.filter((series) =>
    relevantSymbols.has(normalizeSymbol(series.symbol)),
  )
  if (relevantUnderlying.length === 0) return null

  const candlesByTime = new Map<number, { symbol: string; close: number }[]>()
  let source: 'H1' | 'D1' | undefined
  const sleeves = new Set<SleeveKey>()
  sortedDeals.forEach((deal) => {
    if (deal.sleeve) sleeves.add(deal.sleeve)
  })

  relevantUnderlying.forEach((series) => {
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
  const firstDealTime = sortedDeals[0]?.time
  const startTime = Number.isFinite(firstDealTime ?? NaN)
    ? source === 'H1'
      ? toHourStart(firstDealTime as number)
      : toDayStart(firstDealTime as number)
    : Number.NaN
  const activeCandleTimes = Number.isFinite(startTime)
    ? candleTimes.filter((time) => time >= (startTime as number))
    : candleTimes
  const latestPriceBySymbol = new Map<string, number>()
  const pointValues = inferPointValues(sortedDeals)
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
    while (dealIndex < sortedDeals.length && sortedDeals[dealIndex].time <= time) {
      const deal = sortedDeals[dealIndex]
      dealIndex += 1
      if (!Number.isFinite(deal.time)) continue

      const notional = Number.isFinite(deal.notional) ? deal.notional : 0
      balance += notional
      if (deal.sleeve) {
        const sleeveBalance = balanceBySleeve.get(deal.sleeve) ?? startCapital
        balanceBySleeve.set(deal.sleeve, sleeveBalance + notional)
      }
      const symbol = normalizeSymbol(getDealSymbol(deal))
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
        const sleevePositions = deal.sleeve ? positionsBySleeve.get(deal.sleeve) : undefined
        upsertPosition(positions, positionKey, symbol, direction, volume, price)
        if (sleevePositions) {
          upsertPosition(sleevePositions, positionKey, symbol, direction, volume, price)
        }
      } else {
        const sleevePositions = deal.sleeve ? positionsBySleeve.get(deal.sleeve) : undefined
        reducePosition(positions, positionKey, volume)
        if (sleevePositions) reducePosition(sleevePositions, positionKey, volume)
      }
    }

    const candleUpdates = candlesByTime.get(time) ?? []
    candleUpdates.forEach((update) => {
      latestPriceBySymbol.set(update.symbol, update.close)
    })

    let openPnl = 0
    positions.forEach((position) => {
      const price = latestPriceBySymbol.get(position.symbol)
      const pointValue =
        pointValues.byPosition.get(position.key) ?? pointValues.bySymbol.get(position.symbol)
      if (!Number.isFinite(price ?? NaN) || !Number.isFinite(pointValue ?? NaN)) return
      openPnl +=
        ((price as number) - position.avgEntryPrice) *
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
        const pointValue =
          pointValues.byPosition.get(position.key) ?? pointValues.bySymbol.get(position.symbol)
        if (!Number.isFinite(price ?? NaN) || !Number.isFinite(pointValue ?? NaN)) return
        sleeveOpenPnl +=
          ((price as number) - position.avgEntryPrice) *
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
    const returns = series.map((point, index) => {
      const previousEquity = index === 0 ? startCapital : series[index - 1].equity
      const previousPortfolioEquity = index === 0 ? startCapital : equitySeries[index - 1]?.equity
      const pnl =
        Number.isFinite(previousEquity) && Number.isFinite(point.equity)
          ? point.equity - previousEquity
          : Number.NaN
      const value =
        Number.isFinite(previousPortfolioEquity) && previousPortfolioEquity > 0
          ? pnl / (previousPortfolioEquity as number)
          : Number.NaN
      return { time: point.time, value }
    })
    drawdownBySleeve.set(sleeve, buildIndexAndDrawdown(returns).drawdown)
  })
  const usesCustomExposure = options.sleeves != null || options.sleeveWeights != null
  return {
    drawdown: usesCustomExposure
      ? buildWeightedMtmDrawdown(
          equitySeries,
          sleeveEquitySeries,
          startCapital,
          options.sleeves,
          options.sleeveWeights,
        )
      : buildDrawdownFromEquity(equitySeries, startCapital),
    source,
    drawdownBySleeve,
  }
}
