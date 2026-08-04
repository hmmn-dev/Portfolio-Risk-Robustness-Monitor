import { describe, expect, it } from 'vitest'
import { resolveMtmDrawdownCoverage } from '../drawdownCoverage'

const day = (offset: number) => Date.UTC(2024, 0, 1 + offset)

describe('resolveMtmDrawdownCoverage', () => {
  it('uses realized drawdown before and after available candle coverage', () => {
    const realized = [
      { time: day(0), value: 0 },
      { time: day(1), value: -1 },
      { time: day(2), value: -2 },
      { time: day(3), value: -3 },
    ]
    const mtm = [
      { time: day(1), value: -1.5 },
      { time: day(2), value: -2.5 },
    ]

    const result = resolveMtmDrawdownCoverage(realized, mtm)

    expect(result.drawdown).toEqual([realized[0], mtm[0], mtm[1], realized[3]])
    expect(result.realizedFallback).toEqual([realized[0], realized[3]])
  })

  it('clips legacy MTM points outside the realized portfolio period', () => {
    const realized = [
      { time: day(1), value: 0 },
      { time: day(2), value: -1 },
      { time: day(3), value: -2 },
    ]
    const mtm = Array.from({ length: 7 }, (_, offset) => ({
      time: day(offset - 1),
      value: -offset,
    }))

    const result = resolveMtmDrawdownCoverage(realized, mtm)

    expect(result.drawdown.map((point) => point.time)).toEqual([day(1), day(2), day(3)])
    expect(result.realizedFallback).toEqual([])
  })

  it("keeps intraday MTM observations on the portfolio's final UTC day", () => {
    const realized = [
      { time: day(0), value: 0 },
      { time: day(2), value: -2 },
    ]
    const mtm = [
      { time: day(0), value: 0 },
      { time: day(2) + 12 * 60 * 60 * 1000, value: -3 },
    ]

    const result = resolveMtmDrawdownCoverage(realized, mtm)

    expect(result.drawdown).toEqual(mtm)
    expect(result.realizedFallback).toEqual([])
  })

  it('falls back entirely to realized drawdown when no candle observations overlap', () => {
    const realized = [
      { time: day(3), value: -1 },
      { time: day(4), value: -2 },
    ]

    const result = resolveMtmDrawdownCoverage(realized, [{ time: day(0), value: -5 }])

    expect(result.drawdown).toEqual(realized)
    expect(result.realizedFallback).toEqual(realized)
  })
})
