import type { DealRow, SleeveKey } from './types'
import { getDealSymbol } from './portfolioSeriesHelpers'

export type TradeStats = {
  tradeCount: number
  directionalTradeCount: number
  longExposurePct: number
}

export type TradeStatsOptions = {
  sleeves?: ReadonlySet<SleeveKey>
  startTime?: number
  endTime?: number
}

type TradeDirection = 'buy' | 'sell' | 'unknown' | 'conflict'

type TradeRecord = {
  openTime: number
  direction: TradeDirection
}

const getTradeKey = (deal: DealRow) => {
  const symbol = getDealSymbol(deal)
  const positionId = deal.positionId
  if (positionId != null && Number.isFinite(positionId) && positionId !== 0) {
    return `${deal.sleeve}::${symbol}::position::${positionId}`
  }
  return `${deal.sleeve}::${symbol}::deal::${deal.deal}::${deal._seq}`
}

const mergeDirection = (current: TradeDirection, next: DealRow['side']): TradeDirection => {
  if (!next) return current
  if (current === 'unknown') return next
  if (current === 'conflict') return current
  return current === next ? current : 'conflict'
}

export const computeTradeStats = (
  deals: DealRow[],
  options: TradeStatsOptions = {},
): TradeStats => {
  const trades = new Map<string, TradeRecord>()

  deals.forEach((deal) => {
    if (deal.entryType !== 'in' || !Number.isFinite(deal.time)) return
    if (options.sleeves && !options.sleeves.has(deal.sleeve)) return

    const key = getTradeKey(deal)
    const existing = trades.get(key)
    trades.set(key, {
      openTime: existing ? Math.min(existing.openTime, deal.time) : deal.time,
      direction: mergeDirection(existing?.direction ?? 'unknown', deal.side),
    })
  })

  const visibleTrades = Array.from(trades.values()).filter(
    (trade) =>
      (options.startTime == null || trade.openTime >= options.startTime) &&
      (options.endTime == null || trade.openTime <= options.endTime),
  )
  const directionalTrades = visibleTrades.filter(
    (trade) => trade.direction === 'buy' || trade.direction === 'sell',
  )
  const longTrades = directionalTrades.filter((trade) => trade.direction === 'buy').length

  return {
    tradeCount: visibleTrades.length,
    directionalTradeCount: directionalTrades.length,
    longExposurePct:
      directionalTrades.length > 0 ? (longTrades / directionalTrades.length) * 100 : Number.NaN,
  }
}
