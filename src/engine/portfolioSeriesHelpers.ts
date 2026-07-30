import type { DailyPoint, DealRow } from './types'

export const getDealSymbol = (deal: DealRow) => {
  if (deal.symbol && deal.symbol.trim()) return deal.symbol.trim()
  const parts = deal.sleeve.includes(' — ') ? deal.sleeve.split(' — ') : deal.sleeve.split(' - ')
  if (parts.length > 1) return parts[parts.length - 1].trim()
  return 'UNSPECIFIED'
}

export const buildIndexAndDrawdown = (returns: DailyPoint[]) => {
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

export const toDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export const toHourStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours())
}

export const buildDrawdownFromEquity = (series: { time: number; equity: number }[]) => {
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
