import {
  buildDrawdownFromEquity,
  buildIndexAndDrawdown,
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

const getPositionKey = (deal: DealRow, symbol: string) => {
  if (Number.isFinite(deal.positionId ?? NaN) && (deal.positionId ?? 0) !== 0) {
    return `${symbol}::pid::${deal.positionId as number}`
  }
  if (Number.isFinite(deal.magic ?? NaN) && (deal.magic ?? 0) !== 0) {
    return `${symbol}::magic::${deal.magic as number}`
  }
  return `${symbol}::deal::${deal.deal}`
}

export const buildMtmDrawdown = (
  deals: DealRow[],
  underlyingSeries: UnderlyingSeries[],
  startCapital: number,
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
        const pointValue = pointValueBySymbol.get(position.symbol)
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
      const previousEquity = index === 0 ? Number.NaN : series[index - 1].equity
      const previousPortfolioEquity = index === 0 ? Number.NaN : equitySeries[index - 1]?.equity
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
  return {
    drawdown: buildDrawdownFromEquity(equitySeries),
    source,
    drawdownBySleeve,
  }
}
