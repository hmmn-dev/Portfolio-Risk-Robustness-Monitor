import { describe, expect, it } from 'vitest'
import {
  getPairCoverage,
  rollingAverage,
  rollingOls,
  rollingOlsPairs,
  rollingSharpe,
  rollingWinrate,
} from '../statsRolling'

const expectAllNaN = (values: number[]) => {
  expect(values.every((value) => Number.isNaN(value))).toBe(true)
}

describe('rollingAverage', () => {
  it('uses the available prefix until the window is full', () => {
    expect(rollingAverage([1, 2, 3, 4], 3)).toEqual([1, 1.5, 2, 3])
  })

  it('returns zeros for a non-positive window', () => {
    expect(rollingAverage([1, 2], 0)).toEqual([0, 0])
  })
})

describe('rollingSharpe', () => {
  it('annualizes mean return over population standard deviation', () => {
    const result = rollingSharpe([1, 2, 3, 4], 3)

    expect(Number.isNaN(result[0])).toBe(true)
    expect(Number.isNaN(result[1])).toBe(true)
    expect(result[2]).toBeCloseTo((2 / Math.sqrt(2 / 3)) * Math.sqrt(252))
    expect(result[3]).toBeCloseTo((3 / Math.sqrt(2 / 3)) * Math.sqrt(252))
  })

  it('returns NaN for zero variance or invalid windows', () => {
    expectAllNaN(rollingSharpe([2, 2, 2], 2))
    expectAllNaN(rollingSharpe([1, 2], 0))
  })
})

describe('rollingWinrate', () => {
  it('excludes inactive returns and counts wins in each full window', () => {
    const result = rollingWinrate([1, 0, -1, 1e-9], 3)

    expect(Number.isNaN(result[0])).toBe(true)
    expect(Number.isNaN(result[1])).toBe(true)
    expect(result[2]).toBe(0.5)
    expect(result[3]).toBe(0)
  })

  it('returns NaN for windows with no active observations', () => {
    expectAllNaN(rollingWinrate([0, 1e-9, 0], 2))
    expectAllNaN(rollingWinrate([1, -1], -1))
  })
})

describe('rollingOls', () => {
  it('recovers alpha and beta for each complete window', () => {
    const result = rollingOls([1, 2, 3, 4], [5, 7, 9, 11], 3)

    expectAllNaN(result.alpha.slice(0, 2))
    expectAllNaN(result.beta.slice(0, 2))
    expect(result.alpha[2]).toBeCloseTo(3)
    expect(result.alpha[3]).toBeCloseTo(3)
    expect(result.beta[2]).toBeCloseTo(2)
    expect(result.beta[3]).toBeCloseTo(2)
  })

  it('returns NaN for mismatched inputs and singular regressors', () => {
    expectAllNaN(rollingOls([1, 2], [1], 2).alpha)
    expectAllNaN(rollingOls([1, 1, 1], [1, 2, 3], 3).beta)
  })
})

describe('rollingOlsPairs', () => {
  it('ignores non-finite pairs and recovers coefficients with enough data', () => {
    const result = rollingOlsPairs([1, 2, Number.NaN, 4, 5], [5, 8, Number.NaN, 14, 17], 5, {
      minObs: 4,
      minActive: 4,
    })

    expectAllNaN(result.alpha.slice(0, 4))
    expectAllNaN(result.beta.slice(0, 4))
    expect(result.alpha[4]).toBeCloseTo(2)
    expect(result.beta[4]).toBeCloseTo(3)
  })

  it('enforces minimum observations and active dependent returns', () => {
    const tooFewPairs = rollingOlsPairs([1, 2, Number.NaN, 4], [2, 4, Number.NaN, 8], 4, {
      minObs: 4,
      minActive: 1,
    })
    const inactive = rollingOlsPairs([1, 2, 3], [0, 0, 0], 3, {
      minObs: 3,
      minActive: 1,
    })

    expect(Number.isNaN(tooFewPairs.beta[3])).toBe(true)
    expect(Number.isNaN(inactive.beta[2])).toBe(true)
  })

  it('returns correctly sized NaN arrays for invalid inputs', () => {
    const result = rollingOlsPairs([1, 2], [1], 2)

    expect(result.alpha).toHaveLength(2)
    expectAllNaN(result.alpha)
    expectAllNaN(result.beta)
  })
})

describe('getPairCoverage', () => {
  it('counts aligned and active dependent observations in the latest window', () => {
    expect(getPairCoverage([1, 2, Number.NaN, 4, 5], [0, 0.2, 0.3, Number.NaN, -0.1], 4)).toEqual({
      alignedObservations: 2,
      activeObservations: 2,
    })
  })

  it('returns empty coverage for invalid inputs', () => {
    expect(getPairCoverage([1], [1, 2], 2)).toEqual({
      alignedObservations: 0,
      activeObservations: 0,
    })
    expect(getPairCoverage([1], [1], 0)).toEqual({
      alignedObservations: 0,
      activeObservations: 0,
    })
  })
})
