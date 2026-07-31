import { describe, expect, it } from 'vitest'
import type { DailyPoint, ReportModel, UnderlyingDailyReturn } from '../../../engine/types'
import {
  computePadding,
  computeSeriesBounds,
  ensureStartPoint,
  fillSeries,
} from '../helpers/chartSeries'
import {
  alignPairsByDay,
  computeMean,
  computeSharpe,
  computeWinrate,
  getLastFinite,
  resolveBaseCapital,
  sanitizeSeries,
  sumFinite,
} from '../helpers/series'
import { invertMatrix, multiplyMatrixVector, portfolioRegression } from '../helpers/regression'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

describe('report statistics', () => {
  it('calculates Sharpe from finite values with population variance', () => {
    expect(computeSharpe([1, 2, Number.NaN])).toBeCloseTo(3 * Math.sqrt(252))
    expect(Number.isNaN(computeSharpe([]))).toBe(true)
    expect(Number.isNaN(computeSharpe([2, 2]))).toBe(true)
  })

  it('calculates finite mean and sum', () => {
    expect(computeMean([1, Number.NaN, 3])).toBe(2)
    expect(Number.isNaN(computeMean([Number.NaN]))).toBe(true)
    expect(sumFinite([1, Number.POSITIVE_INFINITY, -3])).toBe(-2)
  })

  it('calculates win rate only from active observations', () => {
    expect(computeWinrate([1, -1, 0, 1e-9])).toBe(0.5)
    expect(Number.isNaN(computeWinrate([0, 1e-9]))).toBe(true)
    expect(computeWinrate([0.01, 0.001, -0.1], 0.005)).toBe(0.5)
  })

  it('finds the last finite observation and sanitizes non-finite values', () => {
    expect(getLastFinite([1, Number.NaN, 3, Number.NaN])).toBe(3)
    expect(Number.isNaN(getLastFinite([Number.NaN]))).toBe(true)
    expect(sanitizeSeries([1, Number.NaN, Number.POSITIVE_INFINITY])).toEqual([1, 0, 0])
  })
})

describe('chart calculations', () => {
  it('selects the largest configured padding constraint', () => {
    expect(computePadding(-10, 10, 0.1)).toBe(2)
    expect(computePadding(5, 5, 0.1, 3)).toBe(3)
  })

  it('calculates padded series bounds for ranges and constants', () => {
    expect(computeSeriesBounds([Number.NaN])).toEqual({ min: 0, max: 1 })
    expect(computeSeriesBounds([2, 4], 0.25)).toEqual({ min: 1.5, max: 4.5 })
    expect(computeSeriesBounds([10])).toEqual({ min: 9, max: 11 })
  })

  it('fills gaps in both directions without mutating the input', () => {
    const input: DailyPoint[] = [
      { time: 1, value: Number.NaN },
      { time: 2, value: 2 },
      { time: 3, value: Number.NaN },
      { time: 4, value: 4 },
    ]

    expect(fillSeries(input).map((point) => point.value)).toEqual([2, 2, 2, 4])
    expect(Number.isNaN(input[0].value)).toBe(true)
  })

  it('sorts a series and replaces only a non-finite starting value', () => {
    const result = ensureStartPoint([
      { time: 3, value: 3 },
      { time: 1, value: Number.NaN },
      { time: 2, value: 2 },
    ])

    expect(result).toEqual([
      { time: 1, value: 2 },
      { time: 2, value: 2 },
      { time: 3, value: 3 },
    ])
  })
})

describe('day alignment', () => {
  it('aligns exact days and uses an adjacent market day when needed', () => {
    const returnMap = new Map([
      [day(0), 0.1],
      [day(2), 0.3],
    ])
    const result = alignPairsByDay(
      [
        { time: day(0), value: 1 },
        { time: day(1), value: 2 },
        { time: day(3), value: Number.NaN },
      ],
      returnMap,
    )

    expect(result.xs).toEqual([0.1, 0.1, 0.3])
    expect(result.ys.slice(0, 2)).toEqual([1, 2])
    expect(Number.isNaN(result.ys[2])).toBe(true)
    expect(result.validCount).toBe(2)
    expect(result.times).toEqual([day(0), day(1), day(3)])
  })
})

describe('matrix calculations', () => {
  it('inverts a matrix using a row swap when the first pivot is zero', () => {
    const inverse = invertMatrix([
      [0, 2],
      [1, 3],
    ])

    expect(inverse?.[0][0]).toBeCloseTo(-1.5)
    expect(inverse?.[0][1]).toBeCloseTo(1)
    expect(inverse?.[1][0]).toBeCloseTo(0.5)
    expect(inverse?.[1][1]).toBeCloseTo(0)
  })

  it('returns null for a singular matrix', () => {
    expect(
      invertMatrix([
        [1, 2],
        [2, 4],
      ]),
    ).toBeNull()
  })

  it('multiplies a matrix and vector', () => {
    expect(
      multiplyMatrixVector(
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
      ),
    ).toEqual([17, 39])
  })
})

describe('portfolioRegression', () => {
  const factorReturns = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04]
  const portfolioDays: ReportModel['portfolio']['days'] = factorReturns.map(
    (factorReturn, index) => ({
      time: day(index),
      pnl: 0,
      equity: 100,
      denom: 100,
      return: 0.001 + 1.5 * factorReturn,
    }),
  )
  const underlying: UnderlyingDailyReturn[] = factorReturns.map((value, index) => ({
    symbol: 'EURUSD',
    time: day(index),
    close: 1,
    return: value,
  }))

  it('recovers annualized alpha, factor beta, and R-squared', () => {
    const result = portfolioRegression(portfolioDays, ['EURUSD'], {
      EURUSD: underlying,
    })

    expect(result?.n).toBe(8)
    expect(result?.alphaAnn).toBeCloseTo(25.2)
    expect(result?.betas).toEqual([{ symbol: 'EURUSD', beta: expect.closeTo(1.5) }])
    expect(result?.r2).toBeCloseTo(1)
    expect(result?.conditionIndex).toBeCloseTo(1)
    expect(result?.regularization).toBe(0)
  })

  it('stabilizes coefficients when factors are linearly dependent', () => {
    const values = Array.from({ length: 40 }, (_, index) => {
      const first = Math.sin(index * 0.7) * 0.01
      const second = Math.cos(index * 0.43) * 0.008
      return { first, second, cross: first + second }
    })
    const days: ReportModel['portfolio']['days'] = values.map((value, index) => ({
      time: day(index),
      pnl: 0,
      equity: 100,
      denom: 100,
      return: 0.0005 + 0.4 * value.first - 0.2 * value.second,
    }))
    const buildFactor = (symbol: string, selector: (value: (typeof values)[number]) => number) =>
      values.map((value, index) => ({
        symbol,
        time: day(index),
        close: 1,
        return: selector(value),
      }))
    const underlyingFactors = {
      FIRST: buildFactor('FIRST', (value) => value.first),
      SECOND: buildFactor('SECOND', (value) => value.second),
      CROSS: buildFactor('CROSS', (value) => value.cross),
    }

    const result = portfolioRegression(days, ['FIRST', 'SECOND', 'CROSS'], underlyingFactors)
    const reversed = portfolioRegression(days, ['CROSS', 'SECOND', 'FIRST'], underlyingFactors)

    expect(result?.conditionIndex).toBe(Number.POSITIVE_INFINITY)
    expect(result?.regularization).toBeGreaterThan(0)
    expect(result?.betas.every(({ beta }) => Number.isFinite(beta) && Math.abs(beta) < 1)).toBe(
      true,
    )
    expect(result?.r2).toBeGreaterThan(0.99)
    expect(
      Object.fromEntries(reversed?.betas.map(({ symbol, beta }) => [symbol, beta]) ?? []),
    ).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          result?.betas.map(({ symbol, beta }) => [symbol, expect.closeTo(beta)]) ?? [],
        ),
      ),
    )
  })

  it('returns null without factors, enough rows, or a variable factor', () => {
    expect(portfolioRegression(portfolioDays, [], {})).toBeNull()
    expect(
      portfolioRegression(portfolioDays.slice(0, 5), ['EURUSD'], {
        EURUSD: underlying.slice(0, 5),
      }),
    ).toBeNull()

    const constantFactor = underlying.map((item) => ({ ...item, return: 1 }))
    expect(portfolioRegression(portfolioDays, ['EURUSD'], { EURUSD: constantFactor })).toBeNull()
  })
})

describe('resolveBaseCapital', () => {
  it('derives capital from the first finite equity and PnL pair', () => {
    expect(
      resolveBaseCapital([
        { equity: Number.NaN, pnl: 1 },
        { equity: 1200, pnl: 200 },
      ]),
    ).toBe(1000)
  })

  it('uses the fallback for missing or non-positive capital', () => {
    expect(resolveBaseCapital([], 5000)).toBe(5000)
    expect(resolveBaseCapital([{ equity: 100, pnl: 100 }], 5000)).toBe(5000)
  })
})
