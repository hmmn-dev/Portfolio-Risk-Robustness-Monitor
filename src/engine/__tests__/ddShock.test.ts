import { describe, expect, it } from 'vitest'
import { computeDdShock } from '../ddShock'
import type { DailyPoint } from '../types'

const points = (values: number[]): DailyPoint[] => values.map((value, time) => ({ time, value }))

describe('computeDdShock', () => {
  it('returns an empty neutral result', () => {
    expect(computeDdShock([])).toEqual({
      flag: 'NONE',
      lastWindowMagnitude: 0,
      previousMaxMagnitude: 0,
    })
  })

  it('requires the minimum shock when no prior drawdown exists', () => {
    expect(computeDdShock(points([0, -4]), 2).flag).toBe('NONE')
    expect(computeDdShock(points([0, -5]), 2).flag).toBe('ORANGE')
  })

  it('uses orange and red ratios relative to the previous maximum drawdown', () => {
    const history = [0, -10]

    expect(computeDdShock(points([...history, -14.9]), 1).flag).toBe('NONE')
    expect(computeDdShock(points([...history, -15]), 1).flag).toBe('ORANGE')
    expect(computeDdShock(points([...history, -20]), 1).flag).toBe('RED')
  })

  it('reports magnitudes and ignores non-finite drawdown values', () => {
    const result = computeDdShock(points([-8, Number.NaN, Number.NEGATIVE_INFINITY, -16]), 2)

    expect(result).toEqual({
      flag: 'RED',
      lastWindowMagnitude: 16,
      previousMaxMagnitude: 8,
    })
  })

  it('honors custom thresholds', () => {
    const result = computeDdShock(points([-10, -12]), 1, 1.1, 1.25, 20)

    expect(result.flag).toBe('ORANGE')
  })
})
