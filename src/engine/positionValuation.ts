import { getDealSymbol } from './portfolioSeriesHelpers'
import { stableSort } from './stableSort'
import { normalizeSymbol } from './underlying'
import type { DealRow } from './types'

export type OpenPosition = {
  key: string
  symbol: string
  direction: 1 | -1
  volume: number
  avgEntryPrice: number
}

export const getPositionKey = (deal: DealRow, symbol: string) => {
  const sleevePrefix = `${deal.sleeve}::${symbol}`
  if (Number.isFinite(deal.positionId ?? NaN) && (deal.positionId ?? 0) !== 0) {
    return `${sleevePrefix}::pid::${deal.positionId as number}`
  }
  if (Number.isFinite(deal.magic ?? NaN) && (deal.magic ?? 0) !== 0) {
    return `${sleevePrefix}::magic::${deal.magic as number}`
  }
  return `${sleevePrefix}::deal::${deal.deal}`
}

export const upsertPosition = (
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

export const reducePosition = (
  positions: Map<string, OpenPosition>,
  key: string,
  volume: number,
) => {
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

export const inferPointValues = (deals: DealRow[]) => {
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

export const positionPnl = (position: OpenPosition, price: number, pointValue: number) =>
  (price - position.avgEntryPrice) * position.direction * position.volume * pointValue
