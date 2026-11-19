import { buildPortfolioEquity, buildRecordedPortfolioEquity } from './portfolioEquity'
import { getDealSymbol, toDayStart } from './portfolioSeriesHelpers'
import {
  positionPnl,
  getPositionKey,
  inferPointValues,
  reducePosition,
  upsertPosition,
  type OpenPosition,
} from './positionValuation'
import { stableSort } from './stableSort'
import { normalizeSymbol } from './underlying'
import type { DailyPoint, DealRow, UnderlyingSeries } from './types'

const HOUR = 3600000

// Snapshots anchor account equity. Only changes in cash and modeled floating PnL are
// added after an anchor: adding total floating PnL would count the hedge twice.
export const reconstructPortfolioEquity = (
  deals: DealRow[],
  underlying: UnderlyingSeries[],
  initialCapital: number,
) => {
  const recorded = buildRecordedPortfolioEquity(
    deals.filter((deal) => Number.isFinite(deal.time) && Number.isFinite(deal.equity)),
    initialCapital,
  )
  if (!recorded) return undefined
  const sorted = stableSort(
    deals.filter((deal) => Number.isFinite(deal.time)),
    (a, b) => a.time - b.time || a._seq - b._seq,
  )
  const first = sorted[0].time
  const last = sorted[sorted.length - 1].time
  const firstDay = toDayStart(first)
  const lastDay = toDayStart(last)
  const symbols = new Set(sorted.map((deal) => normalizeSymbol(getDealSymbol(deal))))
  type Close = { symbol: string; price: number; start: number; period: number }
  const closes = new Map<number, Close[]>()
  const opens = new Map<number, Close[]>()
  const candleDaysBySymbol = new Map<string, Set<number>>()
  const candleDays = new Set<number>()
  const usedPeriods = new Set<number>()
  underlying.forEach((series) => {
    const symbol = normalizeSymbol(series.symbol)
    if (!symbols.has(symbol)) return
    const period = series.timeframe === 'H1' ? HOUR : 24 * HOUR
    series.candles.forEach((candle) => {
      const time = candle.time + period - 1
      if (!Number.isFinite(time) || !Number.isFinite(candle.close) || candle.close <= 0) return
      const days = candleDaysBySymbol.get(symbol) ?? new Set<number>()
      for (let day = toDayStart(candle.time); day <= toDayStart(time); day += 24 * HOUR) {
        if (day < firstDay || day > lastDay) continue
        days.add(day)
        candleDays.add(day)
      }
      candleDaysBySymbol.set(symbol, days)
      if (time < first || time > last) return
      const updates = closes.get(time) ?? []
      updates.push({ symbol, price: candle.close, start: candle.time, period })
      closes.set(time, updates)
      if (Number.isFinite(candle.open) && candle.open > 0) {
        const opening = opens.get(candle.time) ?? []
        opening.push({ symbol, price: candle.open, start: candle.time, period })
        opens.set(candle.time, opening)
      }
    })
  })
  if (!candleDays.size) return { ...recorded, recordedOnlyDrawdown: recorded.drawdown }
  const positions = new Map<string, OpenPosition>()
  const points = inferPointValues(sorted)
  const prices = new Map<string, { price: number; time: number; period: number }>()
  let cash = 0
  let validBook = true
  let cursor = 0
  let recordedCursor = 0
  let lastRecordedTime = -Infinity
  let anchor: { equity: number; cash: number; floating: number } | undefined
  const observations: DailyPoint[] = []
  const outsideCoverage: boolean[] = []
  // Source colors describe available trading-day history, including native
  // observations within those days. Missing session hours must not turn the
  // whole history into alternating red/yellow strokes. Valuations below still
  // require contemporaneous prices for every open leg; coverage creates no data.
  const hasCandleDay = (time: number) => {
    const day = toDayStart(time)
    if (!positions.size) return candleDays.has(day)
    for (const position of positions.values()) {
      if (!candleDaysBySymbol.get(position.symbol)?.has(day)) return false
    }
    return true
  }
  const floatingAt = (time: number, required?: Set<string>) => {
    let total = 0
    for (const position of positions.values()) {
      const quote = prices.get(position.symbol)
      const multiplier = points.byPosition.get(position.key) ?? points.bySymbol.get(position.symbol)
      if (
        !quote ||
        time - quote.time > quote.period ||
        (required && !required.has(position.symbol)) ||
        !Number.isFinite(multiplier)
      )
        return undefined
      total += positionPnl(position, quote.price, multiplier ?? NaN)
    }
    return Number.isFinite(total) && validBook ? total : undefined
  }
  const applyDeal = (deal: DealRow) => {
    if (!Number.isFinite(deal.notional)) validBook = false
    else cash += deal.notional
    const symbol = normalizeSymbol(getDealSymbol(deal))
    const price = deal.price
    const volume = deal.volume
    if (deal.entryType === 'in' || deal.entryType === 'out') {
      if (
        !Number.isFinite(price) ||
        !Number.isFinite(volume) ||
        (price ?? 0) <= 0 ||
        (volume ?? 0) <= 0 ||
        (deal.entryType === 'in' && !deal.side)
      ) {
        validBook = false
      } else if (price != null && volume != null) {
        prices.set(symbol, { price, time: deal.time, period: prices.get(symbol)?.period ?? HOUR })
        const key = getPositionKey(deal, symbol)
        if (deal.entryType === 'in')
          upsertPosition(positions, key, symbol, deal.side === 'buy' ? 1 : -1, volume, price)
        else if (!reducePosition(positions, key, volume)) validBook = false
      }
    } else if (deal.notional !== 0) validBook = false
    if (deal.equity != null && Number.isFinite(deal.equity)) {
      lastRecordedTime = deal.time
      recordedCursor++
      const floating = floatingAt(deal.time)
      anchor = floating == null ? undefined : { equity: deal.equity, cash, floating }
      observations.push({ time: deal.time, value: deal.equity })
      outsideCoverage.push(!hasCandleDay(deal.time))
    }
  }
  const times = stableSort(
    Array.from(new Set([...opens.keys(), ...closes.keys()])),
    (a, b) => a - b,
  )
  for (const time of times) {
    // A close belongs to [start, end); events at the next period start stay in that period.
    while (cursor < sorted.length && sorted[cursor].time < time) applyDeal(sorted[cursor++])
    // Candle opens are causal quotes for snapshots inside that candle. Its future close
    // must never be used to value a snapshot earlier in the hour.
    opens.get(time)?.forEach((quote) => prices.set(quote.symbol, { ...quote, time }))
    while (cursor < sorted.length && sorted[cursor].time <= time) applyDeal(sorted[cursor++])
    const updates = closes.get(time) ?? []
    if (!updates.length) continue
    updates.forEach((quote) => prices.set(quote.symbol, { ...quote, time }))
    const floating = floatingAt(time, new Set(updates.map((quote) => quote.symbol)))
    if (!anchor || floating == null) continue
    const periodStart = Math.max(first, ...updates.map((quote) => quote.start))
    // Candles fill unobserved periods. Repricing an hour that already contains
    // native equity invents an extra extreme from stale intrabar quotes. An actual
    // snapshot at the closing boundary also wins over an estimate one ms before it.
    if (lastRecordedTime >= periodStart || recorded.index[recordedCursor]?.time === time + 1)
      continue
    updates.forEach((quote) => usedPeriods.add(quote.period))
    // Native observations win exact ties, including conflicting snapshots in export order.
    if (observations.at(-1)?.time !== time) {
      observations.push({
        time,
        value: anchor.equity + cash - anchor.cash + floating - anchor.floating,
      })
      outsideCoverage.push(false)
    }
  }
  while (cursor < sorted.length) applyDeal(sorted[cursor++])
  const source = !usedPeriods.size
    ? 'deal-snapshots'
    : usedPeriods.size > 1
      ? 'recorded+H1/D1'
      : usedPeriods.has(HOUR)
        ? 'recorded+H1'
        : 'recorded+D1'
  const equity = buildPortfolioEquity(observations, initialCapital, source)
  if (!equity) return undefined
  const recordedOnlyDrawdown = equity.drawdown.filter((_, index) => outsideCoverage[index])
  return { ...equity, recordedOnlyDrawdown }
}
