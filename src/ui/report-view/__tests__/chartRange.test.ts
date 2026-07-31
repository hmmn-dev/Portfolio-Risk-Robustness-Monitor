import { describe, expect, it } from 'vitest'
import {
  filterEquityAndDrawdownRange,
  formatDateInputValue,
  getChartRangeBounds,
  parseDateInputValue,
  resolveChartRange,
} from '../helpers/chartRange'

const point = (year: number, month = 0, day = 1) => ({
  time: Date.UTC(year, month, day),
  value: year,
})

describe('chart range filtering', () => {
  const equity = [point(2018), point(2021, 6, 31), point(2023), point(2026, 6, 31)]
  const drawdown = [point(2019), point(2021, 6, 31), point(2024), point(2026, 6, 30)]

  it('uses the latest shared data timestamp for calendar-year presets', () => {
    const result = filterEquityAndDrawdownRange(equity, drawdown, '5y')

    expect(result.equity.map((item) => item.time)).toEqual([
      Date.UTC(2021, 6, 31),
      Date.UTC(2023, 0, 1),
      Date.UTC(2026, 6, 31),
    ])
    expect(result.drawdown.map((item) => item.time)).toEqual([
      Date.UTC(2021, 6, 31),
      Date.UTC(2024, 0, 1),
      Date.UTC(2026, 6, 30),
    ])
  })

  it('returns complete series for All and handles leap-day cutoffs', () => {
    expect(filterEquityAndDrawdownRange(equity, drawdown, 'all')).toEqual({ equity, drawdown })

    const leapRange = filterEquityAndDrawdownRange(
      [point(2023, 1, 28), point(2023, 2, 1), point(2024, 1, 29)],
      [],
      '1y',
    )
    expect(leapRange.equity.map((item) => item.time)).toEqual([
      Date.UTC(2023, 1, 28),
      Date.UTC(2023, 2, 1),
      Date.UTC(2024, 1, 29),
    ])
  })

  it('filters inclusive custom dates and constrains them to available data', () => {
    const bounds = getChartRangeBounds(equity, drawdown)
    const selection = {
      type: 'custom' as const,
      startTime: Date.UTC(2023, 0, 1),
      endTime: Date.UTC(2030, 0, 1),
    }

    expect(resolveChartRange(bounds, selection)).toEqual({
      minTime: Date.UTC(2023, 0, 1),
      maxTime: Date.UTC(2026, 6, 31),
    })
    expect(filterEquityAndDrawdownRange(equity, drawdown, selection)).toEqual({
      equity: [point(2023), point(2026, 6, 31)],
      drawdown: [point(2024), point(2026, 6, 30)],
    })
  })

  it('includes intraday observations throughout the selected end date', () => {
    const intradayPoint = {
      time: Date.UTC(2026, 6, 30, 18),
      value: 1,
    }

    expect(
      filterEquityAndDrawdownRange([intradayPoint], [], {
        type: 'custom',
        startTime: Date.UTC(2026, 6, 30),
        endTime: Date.UTC(2026, 6, 30),
      }).equity,
    ).toEqual([intradayPoint])
  })

  it('round-trips valid UTC input dates and rejects invalid calendar dates', () => {
    const timestamp = Date.UTC(2026, 6, 31)

    expect(formatDateInputValue(timestamp)).toBe('2026-07-31')
    expect(parseDateInputValue('2026-07-31')).toBe(timestamp)
    expect(parseDateInputValue('2026-02-31')).toBeNull()
    expect(parseDateInputValue('07/31/2026')).toBeNull()
  })
})
