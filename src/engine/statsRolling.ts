export const rollingAverage = (values: number[], window: number): number[] => {
  if (window <= 0) return values.map(() => 0)
  const result: number[] = []
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1)
    const sum = slice.reduce((acc, value) => acc + value, 0)
    result.push(sum / slice.length)
  }
  return result
}

const prefixSums = (values: number[]) => {
  const sums = new Array(values.length + 1).fill(0)
  for (let i = 0; i < values.length; i += 1) {
    sums[i + 1] = sums[i] + values[i]
  }
  return sums
}

export const rollingSharpe = (values: number[], window: number): number[] => {
  if (window <= 0) return values.map(() => Number.NaN)
  const sums = prefixSums(values)
  const sumsSq = prefixSums(values.map((value) => value * value))
  const result: number[] = []
  const annualization = Math.sqrt(252)

  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < window) {
      result.push(Number.NaN)
      continue
    }
    const start = i + 1 - window
    const sum = sums[i + 1] - sums[start]
    const sumSq = sumsSq[i + 1] - sumsSq[start]
    const mean = sum / window
    const variance = sumSq / window - mean * mean
    const stdev = variance > 0 ? Math.sqrt(variance) : 0
    result.push(stdev === 0 ? Number.NaN : (mean / stdev) * annualization)
  }

  return result
}

export const rollingWinrate = (values: number[], window: number, eps = 1e-8): number[] => {
  if (window <= 0) return values.map(() => Number.NaN)
  const wins = values.map((value) => (value > eps ? 1 : 0))
  const active = values.map((value) => (Math.abs(value) > eps ? 1 : 0))
  const winSums = prefixSums(wins)
  const activeSums = prefixSums(active)
  const result: number[] = []

  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < window) {
      result.push(Number.NaN)
      continue
    }
    const start = i + 1 - window
    const winCount = winSums[i + 1] - winSums[start]
    const activeCount = activeSums[i + 1] - activeSums[start]
    result.push(activeCount === 0 ? Number.NaN : winCount / activeCount)
  }

  return result
}

export const rollingOls = (x: number[], y: number[], window: number) => {
  if (window <= 0 || x.length !== y.length) {
    return { alpha: x.map(() => Number.NaN), beta: x.map(() => Number.NaN) }
  }

  const sumX = prefixSums(x)
  const sumY = prefixSums(y)
  const sumXX = prefixSums(x.map((value) => value * value))
  const sumXY = prefixSums(x.map((value, idx) => value * y[idx]))
  const alpha: number[] = []
  const beta: number[] = []

  for (let i = 0; i < x.length; i += 1) {
    if (i + 1 < window) {
      alpha.push(Number.NaN)
      beta.push(Number.NaN)
      continue
    }
    const start = i + 1 - window
    const n = window
    const sx = sumX[i + 1] - sumX[start]
    const sy = sumY[i + 1] - sumY[start]
    const sxx = sumXX[i + 1] - sumXX[start]
    const sxy = sumXY[i + 1] - sumXY[start]
    const denom = n * sxx - sx * sx
    const betaValue = denom === 0 ? Number.NaN : (n * sxy - sx * sy) / denom
    const alphaValue = Number.isFinite(betaValue) ? sy / n - betaValue * (sx / n) : Number.NaN
    beta.push(betaValue)
    alpha.push(alphaValue)
  }

  return { alpha, beta }
}

export const rollingOlsPairs = (
  x: number[],
  y: number[],
  window: number,
  options: { minObs?: number; minActive?: number; eps?: number } = {}
) => {
  if (window <= 0 || x.length !== y.length) {
    return { alpha: x.map(() => Number.NaN), beta: x.map(() => Number.NaN) }
  }
  const minObs = options.minObs ?? Math.floor(window * 0.8)
  const minActive = options.minActive ?? Math.floor(window * 0.15)
  const eps = options.eps ?? 1e-8

  const valid = x.map((value, idx) => Number.isFinite(value) && Number.isFinite(y[idx]))
  const xs = x.map((value, idx) => (valid[idx] ? value : 0))
  const ys = y.map((value, idx) => (valid[idx] ? value : 0))
  const xxs = xs.map((value) => value * value)
  const xys = xs.map((value, idx) => value * ys[idx])
  const counts = valid.map((value) => (value ? 1 : 0))
  const activeCounts = y.map((value, idx) =>
    valid[idx] && Math.abs(value) > eps ? 1 : 0
  )

  const sumX = prefixSums(xs)
  const sumY = prefixSums(ys)
  const sumXX = prefixSums(xxs)
  const sumXY = prefixSums(xys)
  const sumN = prefixSums(counts)
  const sumActive = prefixSums(activeCounts)

  const alpha: number[] = []
  const beta: number[] = []

  for (let i = 0; i < x.length; i += 1) {
    if (i + 1 < window) {
      alpha.push(Number.NaN)
      beta.push(Number.NaN)
      continue
    }
    const start = i + 1 - window
    const n = sumN[i + 1] - sumN[start]
    const active = sumActive[i + 1] - sumActive[start]
    if (n < minObs || active < minActive) {
      alpha.push(Number.NaN)
      beta.push(Number.NaN)
      continue
    }
    const sx = sumX[i + 1] - sumX[start]
    const sy = sumY[i + 1] - sumY[start]
    const sxx = sumXX[i + 1] - sumXX[start]
    const sxy = sumXY[i + 1] - sumXY[start]
    const denom = n * sxx - sx * sx
    const betaValue = denom === 0 ? Number.NaN : (n * sxy - sx * sy) / denom
    const alphaValue = Number.isFinite(betaValue) ? sy / n - betaValue * (sx / n) : Number.NaN
    beta.push(betaValue)
    alpha.push(alphaValue)
  }

  return { alpha, beta }
}
