import type { ReportModel, UnderlyingDailyReturn } from '../../../engine/types'
import { buildReturnMap, normalizeDay } from './series'

const MAX_CONDITION_INDEX = 30
const MIN_FACTOR_SCALE = 1e-12

export const invertMatrix = (matrix: number[][]) => {
  const size = matrix.length
  const identity = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)),
  )
  const augmented = matrix.map((row, index) => [...row, ...identity[index]])

  for (let index = 0; index < size; index += 1) {
    let swapRow = index
    for (let row = index + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][index]) > Math.abs(augmented[swapRow][index])) swapRow = row
    }
    if (
      !Number.isFinite(augmented[swapRow][index]) ||
      Math.abs(augmented[swapRow][index]) < 1e-12
    ) {
      return null
    }
    if (swapRow !== index) {
      const temporary = augmented[index]
      augmented[index] = augmented[swapRow]
      augmented[swapRow] = temporary
    }
    const pivot = augmented[index][index]
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

const symmetricEigenvalues = (matrix: number[][]) => {
  // Jacobi rotations are sufficient for the small symmetric factor matrices used here.
  const values = matrix.map((row) => [...row])
  const size = values.length
  const maxIterations = Math.max(1, size * size * 50)

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let pivotRow = 0
    let pivotColumn = 0
    let largest = 0
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const magnitude = Math.abs(values[row][column])
        if (magnitude > largest) {
          largest = magnitude
          pivotRow = row
          pivotColumn = column
        }
      }
    }
    if (largest < 1e-12) break

    const app = values[pivotRow][pivotRow]
    const aqq = values[pivotColumn][pivotColumn]
    const apq = values[pivotRow][pivotColumn]
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app)
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)

    for (let index = 0; index < size; index += 1) {
      if (index === pivotRow || index === pivotColumn) continue
      const aip = values[index][pivotRow]
      const aiq = values[index][pivotColumn]
      const nextAip = cosine * aip - sine * aiq
      const nextAiq = sine * aip + cosine * aiq
      values[index][pivotRow] = nextAip
      values[pivotRow][index] = nextAip
      values[index][pivotColumn] = nextAiq
      values[pivotColumn][index] = nextAiq
    }

    values[pivotRow][pivotRow] = cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq
    values[pivotColumn][pivotColumn] =
      sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq
    values[pivotRow][pivotColumn] = 0
    values[pivotColumn][pivotRow] = 0
  }

  return values.map((row, index) => row[index])
}

const buildRegularization = (matrix: number[][]) => {
  const eigenvalues = symmetricEigenvalues(matrix).map((value) => Math.max(0, value))
  const maximum = Math.max(...eigenvalues)
  const minimum = Math.min(...eigenvalues)
  const conditionIndex = minimum > 0 ? Math.sqrt(maximum / minimum) : Number.POSITIVE_INFINITY
  if (conditionIndex <= MAX_CONDITION_INDEX) return { conditionIndex, regularization: 0 }

  // Shift the eigenvalues only enough to bring the standardized design back to the target.
  const targetSquared = MAX_CONDITION_INDEX * MAX_CONDITION_INDEX
  const regularization = Math.max(0, (maximum - targetSquared * minimum) / (targetSquared - 1))
  return { conditionIndex, regularization }
}

export const portfolioRegression = (
  portfolioDays: ReportModel['portfolio']['days'],
  symbolList: string[],
  underlyingBySymbol: Record<string, UnderlyingDailyReturn[]>,
) => {
  if (symbolList.length === 0) return null
  const returnMaps: Record<string, Map<number, number>> = {}
  const uniqueSymbols = Array.from(new Set(symbolList))
  uniqueSymbols.forEach((symbol) => {
    const series = underlyingBySymbol[symbol]
    if (series && series.length > 0) {
      returnMaps[symbol] = buildReturnMap(series)
    }
  })
  const availableSymbols = uniqueSymbols.filter((symbol) => returnMaps[symbol])
  if (availableSymbols.length === 0) return null

  const rows: number[][] = []
  const outcomes: number[] = []
  portfolioDays.forEach((day) => {
    if (!Number.isFinite(day.return)) return
    const dayKey = normalizeDay(day.time)
    const row: number[] = []
    for (const symbol of availableSymbols) {
      const value = returnMaps[symbol].get(dayKey)
      if (!Number.isFinite(value)) return
      row.push(value as number)
    }
    rows.push(row)
    outcomes.push(day.return)
  })

  const factorMeans = availableSymbols.map(
    (_, factorIndex) =>
      rows.reduce((sum, row) => sum + row[factorIndex], 0) / Math.max(1, rows.length),
  )
  const factorScales = availableSymbols.map((_, factorIndex) =>
    Math.sqrt(
      rows.reduce((sum, row) => sum + Math.pow(row[factorIndex] - factorMeans[factorIndex], 2), 0) /
        Math.max(1, rows.length),
    ),
  )
  const activeFactorIndices = factorScales
    .map((scale, index) => ({ scale, index }))
    .filter(({ scale }) => Number.isFinite(scale) && scale > MIN_FACTOR_SCALE)
    .map(({ index }) => index)
  if (activeFactorIndices.length === 0 || rows.length < activeFactorIndices.length + 5) return null

  const activeSymbols = activeFactorIndices.map((index) => availableSymbols[index])
  const activeMeans = activeFactorIndices.map((index) => factorMeans[index])
  const activeScales = activeFactorIndices.map((index) => factorScales[index])
  const standardizedRows = rows.map((row) =>
    activeFactorIndices.map(
      (factorIndex, index) => (row[factorIndex] - activeMeans[index]) / activeScales[index],
    ),
  )
  const outcomeMean = outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length
  const centeredOutcomes = outcomes.map((value) => value - outcomeMean)
  const factorCount = activeSymbols.length
  const correlation = Array.from({ length: factorCount }, () => Array(factorCount).fill(0))
  const factorOutcomeCovariance = new Array(factorCount).fill(0)

  standardizedRows.forEach((row, rowIndex) => {
    for (let output = 0; output < factorCount; output += 1) {
      factorOutcomeCovariance[output] += row[output] * centeredOutcomes[rowIndex]
      for (let input = 0; input < factorCount; input += 1) {
        correlation[output][input] += row[output] * row[input]
      }
    }
  })
  for (let output = 0; output < factorCount; output += 1) {
    factorOutcomeCovariance[output] /= rows.length
    for (let input = 0; input < factorCount; input += 1) {
      correlation[output][input] /= rows.length
    }
  }

  const { conditionIndex, regularization } = buildRegularization(correlation)
  const stabilizedCorrelation = correlation.map((row, rowIndex) =>
    row.map((value, columnIndex) => (rowIndex === columnIndex ? value + regularization : value)),
  )
  const inverse = invertMatrix(stabilizedCorrelation)
  if (!inverse) return null
  const standardizedBetas = multiplyMatrixVector(inverse, factorOutcomeCovariance)
  const betas = standardizedBetas.map((value, index) => value / activeScales[index])
  const intercept =
    outcomeMean - betas.reduce((sum, beta, index) => sum + beta * activeMeans[index], 0)

  let squaredError = 0
  let totalSquares = 0
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    let predicted = intercept
    for (let betaIndex = 0; betaIndex < betas.length; betaIndex += 1) {
      predicted += betas[betaIndex] * row[activeFactorIndices[betaIndex]]
    }
    const error = outcomes[index] - predicted
    squaredError += error * error
    const deviation = outcomes[index] - outcomeMean
    totalSquares += deviation * deviation
  }

  return {
    n: outcomes.length,
    alphaAnn: intercept * 252 * 100,
    betas: activeSymbols.map((symbol, index) => ({ symbol, beta: betas[index] })),
    r2: totalSquares > 0 ? 1 - squaredError / totalSquares : Number.NaN,
    conditionIndex,
    regularization,
  }
}
