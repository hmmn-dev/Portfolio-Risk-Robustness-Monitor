import { stableSort } from '../../engine/stableSort'
import type { DailyPoint, ReportModel, UnderlyingDailyReturn } from '../../engine/types'

export const getSeriesValues = (points: DailyPoint[]) => points.map((point) => point.value)

export const splitSleeveLabel = (label: string) => {
  const separator = label.includes(' — ') ? ' — ' : ' - '
  const parts = label.split(separator)
  if (parts.length < 2) return { sleeve: label, symbol: '' }
  return { sleeve: parts.slice(0, -1).join(separator), symbol: parts[parts.length - 1] }
}

export const buildSleeveKey = (sleeve: string, symbol: string) =>
  `${sleeve.trim()}||${symbol.trim()}`

export const buildObfuscationMap = (values: string[], prefix: string) => {
  const uniqueValues = stableSort(
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))),
    (a, b) => a.localeCompare(b)
  )
  const map = new Map<string, string>()
  uniqueValues.forEach((value, index) => {
    map.set(value, `${prefix}-${String(index + 1).padStart(2, '0')}`)
  })
  return map
}

export const normalizeSymbol = (value: string) => {
  let symbol = value.trim().toUpperCase()
  symbol = symbol.replace(/[^A-Z0-9]/g, '')
  symbol = symbol.replace(/^(FX|FX_)/, '')
  symbol = symbol.replace(/(PRO|RAW|M)$/, '')
  return symbol
}

export const normalizeDay = (timestamp: number) => {
  const normalized = timestamp > 1e12 ? timestamp : timestamp * 1000
  const date = new Date(normalized)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export const buildReturnMap = (series: { time: number; return: number }[]) => {
  const map = new Map<number, number>()
  series.forEach((point) => {
    if (Number.isFinite(point.return)) {
      map.set(normalizeDay(point.time), point.return)
    }
  })
  return map
}

export const alignPairsByDay = (points: DailyPoint[], returnsMap: Map<number, number>) => {
  const xs: number[] = []
  const ys: number[] = []
  const times: number[] = []
  let validCount = 0
  const oneDayMs = 24 * 60 * 60 * 1000
  points.forEach((point) => {
    const key = normalizeDay(point.time)
    let underlyingReturn = returnsMap.get(key)
    if (!Number.isFinite(underlyingReturn)) {
      const prev = returnsMap.get(key - oneDayMs)
      const next = returnsMap.get(key + oneDayMs)
      if (Number.isFinite(prev) && Number.isFinite(next)) {
        underlyingReturn = prev
      } else if (Number.isFinite(prev)) {
        underlyingReturn = prev
      } else if (Number.isFinite(next)) {
        underlyingReturn = next
      }
    }
    const x = Number.isFinite(underlyingReturn) ? (underlyingReturn as number) : Number.NaN
    const y = Number.isFinite(point.value) ? point.value : Number.NaN
    xs.push(x)
    ys.push(y)
    times.push(point.time)
    if (Number.isFinite(x) && Number.isFinite(y)) validCount += 1
  })
  return { xs, ys, times, validCount }
}

export const getLastFinite = (values: number[]) => {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(values[i])) return values[i]
  }
  return Number.NaN
}

export const computeSharpe = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return Number.NaN
  const mean = finite.reduce((acc, value) => acc + value, 0) / finite.length
  const variance =
    finite.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / finite.length
  const stdev = variance > 0 ? Math.sqrt(variance) : 0
  return stdev === 0 ? Number.NaN : (mean / stdev) * Math.sqrt(252)
}

export const computeMean = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return Number.NaN
  return finite.reduce((acc, value) => acc + value, 0) / finite.length
}

export const sumFinite = (values: number[]) =>
  values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0)

export const computeWinrate = (values: number[], eps = 1e-8) => {
  const active = values.filter((value) => Math.abs(value) > eps)
  if (active.length === 0) return Number.NaN
  const wins = active.filter((value) => value > 0)
  return wins.length / active.length
}

export const computePadding = (
  min: number,
  max: number,
  ratio: number,
  minPadding = 0,
  minClamp = 1
) => {
  const range = max - min
  const base = Math.max(Math.abs(max), Math.abs(min), 1)
  return Math.max(range * ratio, base * 0.01, minClamp, minPadding)
}

export const fillSeries = (data: DailyPoint[]) => {
  const filled = data.map((point) => ({ ...point }))
  let last = Number.NaN
  for (let i = 0; i < filled.length; i += 1) {
    const value = filled[i].value
    if (Number.isFinite(value)) {
      last = value
    } else if (Number.isFinite(last)) {
      filled[i].value = last
    }
  }
  let firstFinite = filled.find((point) => Number.isFinite(point.value))?.value
  if (!Number.isFinite(firstFinite)) return filled
  for (let i = 0; i < filled.length; i += 1) {
    if (!Number.isFinite(filled[i].value)) {
      filled[i].value = firstFinite as number
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
    range > 0
      ? Math.max(range * paddingRatio, minPad)
      : Math.max(Math.abs(max) * 0.1, minPad, 0.01)
  return { min: min - pad, max: max + pad }
}

export const invertMatrix = (matrix: number[][]) => {
  const n = matrix.length
  const identity = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  )
  const augmented = matrix.map((row, i) => [...row, ...identity[i]])

  for (let i = 0; i < n; i += 1) {
    let pivot = augmented[i][i]
    if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-12) {
      let swapRow = i + 1
      while (swapRow < n && Math.abs(augmented[swapRow][i]) < 1e-12) swapRow += 1
      if (swapRow >= n) return null
      const temp = augmented[i]
      augmented[i] = augmented[swapRow]
      augmented[swapRow] = temp
      pivot = augmented[i][i]
    }
    for (let j = 0; j < 2 * n; j += 1) {
      augmented[i][j] /= pivot
    }
    for (let k = 0; k < n; k += 1) {
      if (k === i) continue
      const factor = augmented[k][i]
      for (let j = 0; j < 2 * n; j += 1) {
        augmented[k][j] -= factor * augmented[i][j]
      }
    }
  }

  return augmented.map((row) => row.slice(n))
}

export const multiplyMatrixVector = (matrix: number[][], vector: number[]) =>
  matrix.map((row) => row.reduce((sum, value, idx) => sum + value * vector[idx], 0))

export const portfolioRegression = (
  portfolioDays: ReportModel['portfolio']['days'],
  symbolList: string[],
  underlyingBySymbol: Record<string, UnderlyingDailyReturn[]>
) => {
  if (symbolList.length === 0) return null
  const returnMaps: Record<string, Map<number, number>> = {}
  symbolList.forEach((symbol) => {
    const series = underlyingBySymbol[symbol]
    if (series && series.length > 0) {
      returnMaps[symbol] = buildReturnMap(series)
    }
  })
  const availableSymbols = symbolList.filter((symbol) => returnMaps[symbol])
  if (availableSymbols.length === 0) return null

  const rows: number[][] = []
  const ys: number[] = []
  portfolioDays.forEach((day) => {
    if (!Number.isFinite(day.return)) return
    const dayKey = normalizeDay(day.time)
    const row = [1]
    for (const symbol of availableSymbols) {
      const value = returnMaps[symbol].get(dayKey)
      if (!Number.isFinite(value)) return
      row.push(value as number)
    }
    rows.push(row)
    ys.push(day.return)
  })

  if (rows.length < availableSymbols.length + 5) return null

  const p = availableSymbols.length + 1
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = new Array(p).fill(0)
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    for (let r = 0; r < p; r += 1) {
      xty[r] += row[r] * ys[i]
      for (let c = 0; c < p; c += 1) {
        xtx[r][c] += row[r] * row[c]
      }
    }
  }

  const inv = invertMatrix(xtx)
  if (!inv) return null
  const coef = multiplyMatrixVector(inv, xty)
  const intercept = coef[0]
  const betas = coef.slice(1)

  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length
  let sse = 0
  let sst = 0
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    let yhat = intercept
    for (let j = 0; j < betas.length; j += 1) {
      yhat += betas[j] * row[j + 1]
    }
    const err = ys[i] - yhat
    sse += err * err
    const dev = ys[i] - yMean
    sst += dev * dev
  }

  const r2 = sst > 0 ? 1 - sse / sst : Number.NaN
  return {
    n: ys.length,
    alphaAnn: intercept * 252 * 100,
    betas: availableSymbols.map((symbol, idx) => ({ symbol, beta: betas[idx] })),
    r2,
  }
}

export const sanitizeSeries = (values: number[]) =>
  values.map((value) => (Number.isFinite(value) ? value : 0))

export const resolveBaseCapital = (days: { equity: number; pnl: number }[], fallback = 10000) => {
  const first = days.find((day) => Number.isFinite(day.equity) && Number.isFinite(day.pnl))
  if (!first) return fallback
  const base = first.equity - first.pnl
  return Number.isFinite(base) && base > 0 ? base : fallback
}
