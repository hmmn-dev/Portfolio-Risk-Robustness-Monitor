import type { DailySeries } from './types'

export const computeMetrics = (series: DailySeries[]) => {
  const totals = series.map((item) =>
    item.points.reduce((acc, point) => acc + point.value, 0)
  )
  const totalExposure = totals.reduce((acc, value) => acc + value, 0)
  return {
    totalExposure,
    sleeves: series.length,
  }
}
