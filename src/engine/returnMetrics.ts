import { stableSort } from './stableSort'
import type { DailyPoint } from './types'

export const computeMonthlyReturns = (returns: DailyPoint[]) => {
  const productsByMonth = new Map<number, number>()

  returns.forEach((point) => {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) return
    const date = new Date(point.time)
    if (Number.isNaN(date.getTime())) return
    const monthTime = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    productsByMonth.set(monthTime, (productsByMonth.get(monthTime) ?? 1) * (1 + point.value))
  })

  return stableSort(
    Array.from(productsByMonth, ([time, product]) => ({ time, value: product - 1 })),
    (left, right) => left.time - right.time,
  )
}

export const computeProfitableMonthsPct = (returns: DailyPoint[]) => {
  const monthlyReturns = computeMonthlyReturns(returns)
  if (monthlyReturns.length === 0) return Number.NaN
  const profitableMonths = monthlyReturns.filter((point) => point.value > 0).length
  return (profitableMonths / monthlyReturns.length) * 100
}

export const computeAnnualizedSortino = (returns: DailyPoint[], annualization = 252) => {
  const values = returns.map((point) => point.value).filter((value) => Number.isFinite(value))
  if (values.length === 0 || !Number.isFinite(annualization) || annualization <= 0) {
    return Number.NaN
  }

  const mean = values.reduce((total, value) => total + value, 0) / values.length
  const downsideDeviation = Math.sqrt(
    values.reduce((total, value) => total + Math.pow(Math.min(value, 0), 2), 0) / values.length,
  )

  return downsideDeviation > 0 ? (mean * Math.sqrt(annualization)) / downsideDeviation : Number.NaN
}
