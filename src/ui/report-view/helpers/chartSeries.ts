import type { DailyPoint } from '../../../engine/types'

export const computePadding = (
  min: number,
  max: number,
  ratio: number,
  minPadding = 0,
  minClamp = 1,
) => {
  const range = max - min
  const base = Math.max(Math.abs(max), Math.abs(min), 1)
  return Math.max(range * ratio, base * 0.01, minClamp, minPadding)
}

export const fillSeries = (data: DailyPoint[]) => {
  const filled = data.map((point) => ({ ...point }))
  let last = Number.NaN
  for (let index = 0; index < filled.length; index += 1) {
    const value = filled[index].value
    if (Number.isFinite(value)) {
      last = value
    } else if (Number.isFinite(last)) {
      filled[index].value = last
    }
  }
  const firstFinite = filled.find((point) => Number.isFinite(point.value))?.value
  if (!Number.isFinite(firstFinite)) return filled
  for (let index = 0; index < filled.length; index += 1) {
    if (!Number.isFinite(filled[index].value)) {
      filled[index].value = firstFinite as number
    } else {
      break
    }
  }
  return filled
}

export const ensureStartPoint = (data: DailyPoint[]) => {
  if (data.length === 0) return data
  const sorted = [...data].sort((a, b) => a.time - b.time)
  const first = sorted[0]
  const next = sorted.find((point) => Number.isFinite(point.value))
  if (!next) return sorted
  if (!Number.isFinite(first.value)) {
    sorted[0] = { ...first, value: next.value }
  }
  return sorted
}

export const computeSeriesBounds = (values: number[], paddingRatio = 0.1, minPad = 0) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return { min: 0, max: 1 }
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const range = max - min
  const pad =
    range > 0 ? Math.max(range * paddingRatio, minPad) : Math.max(Math.abs(max) * 0.1, minPad, 0.01)
  return { min: min - pad, max: max + pad }
}
