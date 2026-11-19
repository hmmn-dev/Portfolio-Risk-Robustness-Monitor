import { describe, expect, it } from 'vitest'
import { benchmarkRelationship } from '../benchmarkRelationships'
import type { DailyPoint } from '../types'

const points = (values: number[]): DailyPoint[] =>
  values.map((value, index) => ({ time: Date.UTC(2024, 0, index + 1), value }))

describe('benchmark relationships', () => {
  it('matches covariance/benchmark variance and keeps correlation independent of positive sizing', () => {
    const benchmark = points([-0.03, 0.01, 0.04, -0.02])
    const strategy = benchmark.map((point) => ({ ...point, value: 0.001 + 0.1 * point.value }))
    const result = benchmarkRelationship(strategy, benchmark, 'daily')
    expect(result.beta).toBeCloseTo(0.1)
    expect(result.correlation).toBeCloseTo(1)
    expect(result.observations).toBe(4)
    const smaller = benchmarkRelationship(
      strategy.map((point) => ({ ...point, value: point.value * 0.01 })),
      benchmark,
      'daily',
    )
    expect(smaller.beta).toBeCloseTo(0.001)
    expect(smaller.correlation).toBeCloseTo(1)
    const inverse = benchmarkRelationship(
      strategy.map((point) => ({ ...point, value: -point.value })),
      benchmark,
      'daily',
    )
    expect(inverse.beta).toBeCloseTo(-0.1)
    expect(inverse.correlation).toBeCloseTo(-1)
  })

  it('aligns UTC dates, resolves duplicate days deterministically, and does not borrow nearby prices', () => {
    const benchmark = points([0.01, -0.02, 0.04, -0.01])
    const strategy = [
      { time: benchmark[2].time + 3600000, value: 0.08 },
      { time: benchmark[0].time, value: 42 },
      { time: benchmark[0].time + 1000, value: 0.02 },
      { time: benchmark[3].time, value: -0.02 },
      { time: Date.UTC(2024, 0, 20), value: 0.2 },
    ]
    const result = benchmarkRelationship(strategy, benchmark, 'daily')
    expect(result.observations).toBe(3)
    expect(result.beta).toBeCloseTo(2)
    expect(result.correlation).toBeCloseTo(1)
  })

  it('compounds monthly returns rather than averaging daily betas or daily returns', () => {
    const benchmark = [
      { time: Date.UTC(2024, 0, 1), value: 0.1 },
      { time: Date.UTC(2024, 0, 2), value: -0.1 },
      { time: Date.UTC(2024, 1, 1), value: 0.02 },
      { time: Date.UTC(2024, 2, 1), value: -0.02 },
    ]
    const strategy = benchmark.map((point) => ({ ...point, value: 2 * point.value }))
    // Monthly benchmark: [-.01, .02, -.02]; strategy: [-.04, .04, -.04].
    const result = benchmarkRelationship(strategy, benchmark, 'monthly')
    expect(result.observations).toBe(3)
    expect(result.beta).toBeCloseTo(28 / 13)
    expect(result.correlation).toBeCloseTo(7 / Math.sqrt(52))
  })

  it('excludes months with missing or invalid counterpart dates instead of inventing partial returns', () => {
    const benchmark = [
      { time: Date.UTC(2024, 0, 1), value: 0.01 },
      { time: Date.UTC(2024, 0, 2), value: 0.02 },
      { time: Date.UTC(2024, 1, 1), value: -0.02 },
      { time: Date.UTC(2024, 2, 1), value: 0.03 },
      { time: Date.UTC(2024, 3, 1), value: -0.04 },
    ]
    const strategy = benchmark.map((point) => ({ ...point, value: 0.5 * point.value }))
    strategy[1].value = NaN
    const result = benchmarkRelationship(strategy, benchmark, 'monthly')
    expect(result.observations).toBe(3)
    expect(result.beta).toBeCloseTo(0.5)
    expect(result.correlation).toBeCloseTo(1)
  })

  it('represents insufficient, constant and non-finite inputs as unavailable evidence', () => {
    const benchmark = points([0.01, -0.02, 0.03])
    expect(benchmarkRelationship([], benchmark, 'daily')).toEqual({
      beta: null,
      correlation: null,
      observations: 0,
    })
    expect(benchmarkRelationship(points([0.01]), benchmark, 'daily').beta).toBeNull()
    expect(
      benchmarkRelationship(points([NaN, Infinity, -Infinity]), benchmark, 'daily').beta,
    ).toBeNull()
    const flat = benchmarkRelationship(points([0, 0, 0]), benchmark, 'daily')
    expect(flat.beta).toBe(0)
    expect(flat.correlation).toBeNull()
    expect(benchmarkRelationship(benchmark, points([0, 0, 0]), 'daily').beta).toBeNull()
  })
})
