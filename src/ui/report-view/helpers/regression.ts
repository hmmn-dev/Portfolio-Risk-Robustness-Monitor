import type { ReportModel, UnderlyingDailyReturn } from '../../../engine/types'
import { buildReturnMap, normalizeDay } from './series'

export const invertMatrix = (matrix: number[][]) => {
  const size = matrix.length
  const identity = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)),
  )
  const augmented = matrix.map((row, index) => [...row, ...identity[index]])

  for (let index = 0; index < size; index += 1) {
    let pivot = augmented[index][index]
    if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-12) {
      let swapRow = index + 1
      while (swapRow < size && Math.abs(augmented[swapRow][index]) < 1e-12) swapRow += 1
      if (swapRow >= size) return null
      const temporary = augmented[index]
      augmented[index] = augmented[swapRow]
      augmented[swapRow] = temporary
      pivot = augmented[index][index]
    }
    for (let column = 0; column < 2 * size; column += 1) {
      augmented[index][column] /= pivot
    }
    for (let row = 0; row < size; row += 1) {
      if (row === index) continue
      const factor = augmented[row][index]
      for (let column = 0; column < 2 * size; column += 1) {
        augmented[row][column] -= factor * augmented[index][column]
      }
    }
  }

  return augmented.map((row) => row.slice(size))
}

export const multiplyMatrixVector = (matrix: number[][], vector: number[]) =>
  matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0))

export const portfolioRegression = (
  portfolioDays: ReportModel['portfolio']['days'],
  symbolList: string[],
  underlyingBySymbol: Record<string, UnderlyingDailyReturn[]>,
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
  const outcomes: number[] = []
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
    outcomes.push(day.return)
  })

  if (rows.length < availableSymbols.length + 5) return null

  const parameterCount = availableSymbols.length + 1
  const xtx = Array.from({ length: parameterCount }, () => Array(parameterCount).fill(0))
  const xty = new Array(parameterCount).fill(0)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    for (let output = 0; output < parameterCount; output += 1) {
      xty[output] += row[output] * outcomes[index]
      for (let input = 0; input < parameterCount; input += 1) {
        xtx[output][input] += row[output] * row[input]
      }
    }
  }

  const inverse = invertMatrix(xtx)
  if (!inverse) return null
  const coefficients = multiplyMatrixVector(inverse, xty)
  const intercept = coefficients[0]
  const betas = coefficients.slice(1)

  const outcomeMean = outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length
  let squaredError = 0
  let totalSquares = 0
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    let predicted = intercept
    for (let betaIndex = 0; betaIndex < betas.length; betaIndex += 1) {
      predicted += betas[betaIndex] * row[betaIndex + 1]
    }
    const error = outcomes[index] - predicted
    squaredError += error * error
    const deviation = outcomes[index] - outcomeMean
    totalSquares += deviation * deviation
  }

  return {
    n: outcomes.length,
    alphaAnn: intercept * 252 * 100,
    betas: availableSymbols.map((symbol, index) => ({ symbol, beta: betas[index] })),
    r2: totalSquares > 0 ? 1 - squaredError / totalSquares : Number.NaN,
  }
}
