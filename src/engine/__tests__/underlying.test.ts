import { describe, expect, it } from 'vitest'
import { normalizeSymbol, normalizeUnderlyingSeries, parseUnderlying } from '../underlying'
import type { UnderlyingCandle } from '../types'

const day = (offset: number, hour = 0) => Date.UTC(2024, 0, 1 + offset, hour)

const candle = (
  time: number,
  close: number,
  overrides: Partial<UnderlyingCandle> = {},
): UnderlyingCandle => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  ...overrides,
})

describe('normalizeSymbol', () => {
  it('removes common broker decorations', () => {
    expect(normalizeSymbol(' fx_eur/usd.raw ')).toBe('EURUSD')
    expect(normalizeSymbol('XAUUSDpro')).toBe('XAUUSD')
    expect(normalizeSymbol('usdjpy.m')).toBe('USDJPY')
  })
})

describe('normalizeUnderlyingSeries', () => {
  it('sorts candles, filters invalid times, and calculates daily returns', () => {
    const result = normalizeUnderlyingSeries('eurusd', [
      candle(day(2), 121),
      candle(0, 999),
      candle(day(0), 100),
      candle(day(1), 110),
    ])

    expect(result.symbol).toBe('EURUSD')
    expect(result.timeframe).toBe('D1')
    expect(result.candles.map((item) => item.time)).toEqual([day(0), day(1), day(2)])
    expect(Number.isNaN(result.daily[0].return)).toBe(true)
    expect(result.daily[1].return).toBeCloseTo(0.1)
    expect(result.daily[2].return).toBeCloseTo(0.1)
  })

  it('detects hourly data and uses the last intraday close for daily returns', () => {
    const result = normalizeUnderlyingSeries('EURUSD', [
      candle(day(0, 10), 100),
      candle(day(0, 11), 105),
      candle(day(1, 10), 108),
      candle(day(1, 11), 110),
    ])

    expect(result.timeframe).toBe('H1')
    expect(result.daily).toHaveLength(2)
    expect(result.daily[0].close).toBe(105)
    expect(result.daily[1].close).toBe(110)
    expect(result.daily[1].return).toBeCloseTo(110 / 105 - 1)
  })

  it('returns NaN when a previous daily close is zero', () => {
    const result = normalizeUnderlyingSeries('EURUSD', [candle(day(0), 0), candle(day(1), 10)])

    expect(Number.isNaN(result.daily[1].return)).toBe(true)
  })
})

describe('parseUnderlying', () => {
  it('parses OHLC values and infers the symbol from the source name', () => {
    const csv = `date,time,open,high,low,close
2024-01-02,10:00,1,4,0.5,3
2024-01-01,10:00,2,3,1,2.5`

    const result = parseUnderlying(csv, { sourceName: 'EURUSD_D1.csv' })

    expect(result.symbol).toBe('EURUSD')
    expect(result.candles.map((item) => item.close)).toEqual([2.5, 3])
    expect(result.daily[1].return).toBeCloseTo(0.2)
  })
})
