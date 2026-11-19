import {
  positionPnl,
  getPositionKey,
  upsertPosition,
  reducePosition,
  inferPointValues,
  type OpenPosition,
} from './positionValuation'
import {
  buildDrawdownFromEquity,
  buildIndexAndDrawdown,
  getDealSymbol,
  toDayStart,
  toHourStart,
} from './portfolioSeriesHelpers'
import { buildPortfolioEquity } from './portfolioEquity'
import { stableSort } from './stableSort'
import { normalizeSymbol } from './underlying'
import type {
  DailyPoint,
  DealRow,
  PortfolioEquitySeries,
  SleeveKey,
  UnderlyingSeries,
} from './types'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export type MtmDrawdownResult = {
  equity?: PortfolioEquitySeries
  realizedFallback?: DailyPoint[]
  drawdown: DailyPoint[]
  source?: 'H1' | 'D1'
  drawdownBySleeve: Map<SleeveKey, DailyPoint[]>
}

export type MtmDrawdownOptions = {
  sleeves?: ReadonlySet<SleeveKey>
  sleeveWeights?: Readonly<Record<SleeveKey, number>>
  // Preserve priced days and explicitly include realized-only days in one path.
  includeRealizedFallback?: boolean
  // Unmodified account index (initial capital = 1), used only for return denominators.
  baselineEquityIndex?: readonly DailyPoint[]
}

const resolveSleeveWeight = (
  sleeve: SleeveKey,
  sleeveWeights?: Readonly<Record<SleeveKey, number>>,
) => {
  const weight = sleeveWeights?.[sleeve]
  if (weight == null) return 1
  return Number.isFinite(weight) && weight >= 0 ? weight : 0
}

const buildWeightedMtmSeries = (
  equitySeries: { time: number; equity: number }[],
  sleeveEquitySeries: Map<SleeveKey, { time: number; equity: number }[]>,
  startCapital: number,
  sleeves: ReadonlySet<SleeveKey> | undefined,
  sleeveWeights: Readonly<Record<SleeveKey, number>> | undefined,
) => {
  const selectedSleeves = stableSort(Array.from(sleeves ?? sleeveEquitySeries.keys()), (a, b) =>
    a.localeCompare(b),
  )
  const returns = equitySeries.map((point, index) => {
    const previousPortfolioEquity = index === 0 ? startCapital : equitySeries[index - 1].equity
    const weightedPnl = selectedSleeves.reduce((total, sleeve) => {
      const series = sleeveEquitySeries.get(sleeve)
      const currentSleeveEquity = series?.[index]?.equity
      const previousSleeveEquity = index === 0 ? startCapital : series?.[index - 1]?.equity
      if (
        !Number.isFinite(currentSleeveEquity ?? NaN) ||
        !Number.isFinite(previousSleeveEquity ?? NaN)
      ) {
        return total
      }
      return (
        total +
        ((currentSleeveEquity as number) - (previousSleeveEquity as number)) *
          resolveSleeveWeight(sleeve, sleeveWeights)
      )
    }, 0)
    return {
      time: point.time,
      value:
        Number.isFinite(previousPortfolioEquity) && previousPortfolioEquity > 0
          ? weightedPnl / previousPortfolioEquity
          : Number.NaN,
    }
  })
  return { ...buildIndexAndDrawdown(returns), returns }
}

export const buildMtmDrawdown = (
  deals: DealRow[],
  underlyingSeries: UnderlyingSeries[],
  startCapital: number,
  options: MtmDrawdownOptions = {},
): MtmDrawdownResult | null => {
  if (!underlyingSeries.length || !Number.isFinite(startCapital) || startCapital <= 0) return null

  const sortedDeals = stableSort(
    deals.filter((deal) => Number.isFinite(deal.time)),
    (a, b) => {
      const byTime = a.time - b.time
      return (
        byTime ||
        (options.includeRealizedFallback
          ? a._seq - b._seq || a.deal.localeCompare(b.deal)
          : a.deal.localeCompare(b.deal) || a._seq - b._seq)
      )
    },
  )
  if (sortedDeals.length === 0) return null

  const relevantSymbols = new Set(
    sortedDeals
      .map((deal) => normalizeSymbol(getDealSymbol(deal)))
      .filter((symbol) => symbol.length > 0 && symbol !== 'UNSPECIFIED'),
  )
  const relevantUnderlying = underlyingSeries.filter((series) =>
    relevantSymbols.has(normalizeSymbol(series.symbol)),
  )
  if (relevantUnderlying.length === 0) return null

  const candlesByTime = new Map<number, { symbol: string; close: number }[]>()
  const source = relevantUnderlying.some((series) => series.timeframe === 'H1') ? 'H1' : 'D1'
  const periodMs = source === 'H1' ? HOUR_MS : DAY_MS
  const sleeves = new Set<SleeveKey>()
  sortedDeals.forEach((deal) => {
    if (deal.sleeve) sleeves.add(deal.sleeve)
  })

  relevantUnderlying.forEach((series) => {
    const symbol = normalizeSymbol(series.symbol)
    if (!symbol) return
    series.candles.forEach((candle) => {
      if (!Number.isFinite(candle.close)) return
      const time = options.includeRealizedFallback
        ? candle.time + (series.timeframe === 'H1' ? HOUR_MS : DAY_MS) - periodMs
        : candle.time
      const list = candlesByTime.get(time) ?? []
      list.push({ symbol, close: candle.close })
      candlesByTime.set(time, list)
    })
  })

  if (candlesByTime.size === 0) return null

  const candleTimes = stableSort(Array.from(candlesByTime.keys()), (a, b) => a - b)
  const firstDealTime = sortedDeals[0]?.time
  const lastDealTime = sortedDeals.at(-1)?.time
  const startTime = Number.isFinite(firstDealTime ?? NaN)
    ? source === 'H1'
      ? toHourStart(firstDealTime as number)
      : toDayStart(firstDealTime as number)
    : Number.NaN
  const endTime = Number.isFinite(lastDealTime ?? NaN)
    ? source === 'H1'
      ? toHourStart(lastDealTime as number)
      : toDayStart(lastDealTime as number)
    : Number.NaN
  const activeCandleTimes =
    Number.isFinite(startTime) && Number.isFinite(endTime)
      ? candleTimes.filter((time) => time >= (startTime as number) && time <= (endTime as number))
      : candleTimes
  const observationTimes = options.includeRealizedFallback
    ? stableSort(
        Array.from(
          new Set([
            ...activeCandleTimes,
            ...sortedDeals.map((deal) =>
              source === 'H1' ? toHourStart(deal.time) : toDayStart(deal.time),
            ),
          ]),
        ),
        (a, b) => a - b,
      )
    : activeCandleTimes
  const baselineIndex = stableSort(
    (options.baselineEquityIndex ?? []).filter(
      (point) => Number.isFinite(point.time) && Number.isFinite(point.value),
    ),
    (a, b) => a.time - b.time,
  )
  let baselineCursor = 0
  let baselineValue: number | undefined
  let hasAnyValuation = false
  const fallbackTimes = new Set<number>()
  const latestPriceBySymbol = new Map<string, number>()
  const pointValues = inferPointValues(sortedDeals)
  const positions = new Map<string, OpenPosition>()
  const positionSleeves = new Map<string, SleeveKey>()
  let equitySeries: { time: number; equity: number }[] = []
  const positionsBySleeve = new Map<SleeveKey, Map<string, OpenPosition>>()
  const balanceBySleeve = new Map<SleeveKey, number>()
  const sleeveEquitySeries = new Map<SleeveKey, { time: number; equity: number }[]>()
  let hasCompleteValuations =
    sortedDeals.some((deal) => deal.entryType === 'in') &&
    sortedDeals.every((deal) =>
      deal.entryType === 'in' || deal.entryType === 'out'
        ? Number.isFinite(deal.price) &&
          Number.isFinite(deal.volume) &&
          (deal.entryType === 'out' || deal.side != null)
        : deal.notional === 0,
    )
  let balance = startCapital
  let dealIndex = 0
  const selected = (sleeve: SleeveKey) =>
    (!options.sleeves || options.sleeves.has(sleeve)) &&
    resolveSleeveWeight(sleeve, options.sleeveWeights) > 0
  const selectedSleeveForPosition = (key: string) => {
    const sleeve = positionSleeves.get(key)
    return sleeve != null && selected(sleeve)
  }
  let selectedInputsValid = true
  let baselineInputsValid = true
  const hasPositionInputs = sortedDeals.some((deal) => deal.entryType === 'in')

  sleeves.forEach((sleeve) => {
    balanceBySleeve.set(sleeve, startCapital)
    positionsBySleeve.set(sleeve, new Map())
    sleeveEquitySeries.set(sleeve, [])
  })

  for (const time of observationTimes) {
    // Imported OHLC timestamps identify the period start; their close is observed at period end.
    const observationEnd = time + periodMs
    while (dealIndex < sortedDeals.length && sortedDeals[dealIndex].time < observationEnd) {
      const deal = sortedDeals[dealIndex]
      dealIndex += 1
      if (!Number.isFinite(deal.time)) continue
      const validDeal =
        Number.isFinite(deal.notional) &&
        (deal.entryType === 'in' || deal.entryType === 'out'
          ? Number.isFinite(deal.price) &&
            Number.isFinite(deal.volume) &&
            (deal.price ?? 0) > 0 &&
            (deal.volume ?? 0) > 0 &&
            (deal.entryType !== 'in' || deal.side != null)
          : deal.notional === 0)
      if (!validDeal) {
        baselineInputsValid = false
        if (selected(deal.sleeve)) selectedInputsValid = false
      }

      const notional = Number.isFinite(deal.notional) ? deal.notional : 0
      balance += notional
      if (deal.sleeve) {
        const sleeveBalance = balanceBySleeve.get(deal.sleeve) ?? startCapital
        balanceBySleeve.set(deal.sleeve, sleeveBalance + notional)
      }
      const symbol = normalizeSymbol(getDealSymbol(deal))
      if (!symbol) continue
      const entryType = deal.entryType
      if (!entryType || entryType === 'unknown') continue
      if (!Number.isFinite(deal.price ?? NaN) || !Number.isFinite(deal.volume ?? NaN)) {
        continue
      }
      const price = deal.price as number
      const volume = deal.volume as number
      if (volume <= 0) continue
      if (price <= 0) continue

      const positionKey = getPositionKey(deal, symbol)
      positionSleeves.set(positionKey, deal.sleeve)
      if (entryType === 'in') {
        if (!deal.side) continue
        const direction: 1 | -1 = deal.side === 'buy' ? 1 : -1
        const sleevePositions = deal.sleeve ? positionsBySleeve.get(deal.sleeve) : undefined
        upsertPosition(positions, positionKey, symbol, direction, volume, price)
        if (sleevePositions) {
          upsertPosition(sleevePositions, positionKey, symbol, direction, volume, price)
        }
      } else {
        const sleevePositions = deal.sleeve ? positionsBySleeve.get(deal.sleeve) : undefined
        const closed = reducePosition(positions, positionKey, volume)
        if (!closed) {
          baselineInputsValid = false
          if (selected(deal.sleeve)) selectedInputsValid = false
        }
        if (sleevePositions) reducePosition(sleevePositions, positionKey, volume)
      }
    }

    const candleUpdates = candlesByTime.get(time) ?? []
    candleUpdates.forEach((update) => {
      latestPriceBySymbol.set(update.symbol, update.close)
    })

    let openPnl = 0
    let baselineComplete = baselineInputsValid && candleUpdates.length > 0
    let selectedComplete = selectedInputsValid && candleUpdates.length > 0
    positions.forEach((position) => {
      const price = latestPriceBySymbol.get(position.symbol)
      const pointValue =
        pointValues.byPosition.get(position.key) ?? pointValues.bySymbol.get(position.symbol)
      if (!Number.isFinite(price ?? NaN) || !Number.isFinite(pointValue ?? NaN)) {
        hasCompleteValuations = false
        baselineComplete = false
        if (selectedSleeveForPosition(position.key)) selectedComplete = false
        return
      }
      if (!candleUpdates.some((update) => update.symbol === position.symbol)) {
        hasCompleteValuations = false
        baselineComplete = false
        if (selectedSleeveForPosition(position.key)) selectedComplete = false
      }
      openPnl += positionPnl(position, price as number, pointValue as number)
    })

    while (
      baselineCursor < baselineIndex.length &&
      baselineIndex[baselineCursor].time < observationEnd
    ) {
      baselineValue = baselineIndex[baselineCursor++].value * startCapital
    }
    const accountEquity = baselineValue != null && baselineValue > 0 ? baselineValue : undefined
    const nativeBaselineAvailable = accountEquity != null
    const complete = selectedComplete && (baselineComplete || nativeBaselineAvailable)
    if (complete && hasPositionInputs) hasAnyValuation = true
    else fallbackTimes.add(time)
    equitySeries.push({
      time,
      equity:
        options.includeRealizedFallback && baselineValue != null
          ? baselineValue
          : balance + (options.includeRealizedFallback && !complete ? 0 : openPnl),
    })

    sleeves.forEach((sleeve) => {
      const sleevePositions = positionsBySleeve.get(sleeve)
      if (!sleevePositions) return
      let sleeveOpenPnl = 0
      sleevePositions.forEach((position) => {
        const price = latestPriceBySymbol.get(position.symbol)
        const pointValue =
          pointValues.byPosition.get(position.key) ?? pointValues.bySymbol.get(position.symbol)
        if (!Number.isFinite(price ?? NaN) || !Number.isFinite(pointValue ?? NaN)) return
        sleeveOpenPnl += positionPnl(position, price as number, pointValue as number)
      })
      const sleeveBalance = balanceBySleeve.get(sleeve) ?? startCapital
      const equity =
        sleeveBalance + (options.includeRealizedFallback && !complete ? 0 : sleeveOpenPnl)
      sleeveEquitySeries.get(sleeve)?.push({ time, equity })
    })
  }

  if (options.includeRealizedFallback) {
    const valuedDays = new Set(
      equitySeries
        .filter((point) => !fallbackTimes.has(point.time))
        .map((point) => toDayStart(point.time)),
    )
    // A missing session hour is not a new balance-based equity valuation. Keep
    // genuine marks within priced days; use realized fallback only on days for
    // which no complete mark exists. Apply weights after selecting this timeline.
    equitySeries = equitySeries.filter(
      (point) => !fallbackTimes.has(point.time) || !valuedDays.has(toDayStart(point.time)),
    )
    const retainedTimes = new Set(equitySeries.map((point) => point.time))
    sleeveEquitySeries.forEach((series, sleeve) =>
      sleeveEquitySeries.set(
        sleeve,
        series.filter((point) => retainedTimes.has(point.time)),
      ),
    )
  }

  if (equitySeries.length === 0) return null
  const drawdownBySleeve = new Map<SleeveKey, DailyPoint[]>()
  sleeves.forEach((sleeve) => {
    const series = sleeveEquitySeries.get(sleeve) ?? []
    if (series.length === 0) {
      drawdownBySleeve.set(sleeve, [])
      return
    }
    const returns = series.map((point, index) => {
      const previousEquity = index === 0 ? startCapital : series[index - 1].equity
      const previousPortfolioEquity = index === 0 ? startCapital : equitySeries[index - 1]?.equity
      const pnl =
        Number.isFinite(previousEquity) && Number.isFinite(point.equity)
          ? point.equity - previousEquity
          : Number.NaN
      const value =
        Number.isFinite(previousPortfolioEquity) && previousPortfolioEquity > 0
          ? pnl / (previousPortfolioEquity as number)
          : Number.NaN
      return { time: point.time, value }
    })
    drawdownBySleeve.set(sleeve, buildIndexAndDrawdown(returns).drawdown)
  })
  const usesCustomExposure = options.sleeves != null || options.sleeveWeights != null
  const weighted = usesCustomExposure
    ? buildWeightedMtmSeries(
        equitySeries,
        sleeveEquitySeries,
        startCapital,
        options.sleeves,
        options.sleeveWeights,
      )
    : undefined
  const coversPeriod =
    toDayStart(equitySeries[0].time) === toDayStart(sortedDeals[0].time) &&
    toDayStart(equitySeries.at(-1)?.time ?? NaN) === toDayStart(sortedDeals.at(-1)?.time ?? NaN)
  const equity = (
    options.includeRealizedFallback
      ? hasAnyValuation &&
        (weighted?.returns.every((point) => Number.isFinite(point.value)) ?? true)
      : hasCompleteValuations && coversPeriod
  )
    ? buildPortfolioEquity(
        weighted
          ? weighted.index.map((point) => ({
              time: point.time,
              value: point.value * startCapital,
            }))
          : equitySeries.map((point) => ({ time: point.time, value: point.equity })),
        startCapital,
        source,
      )
    : undefined
  return {
    equity,
    realizedFallback: options.includeRealizedFallback
      ? equity?.drawdown.filter((point) => fallbackTimes.has(point.time))
      : undefined,
    drawdown:
      equity?.drawdown ?? weighted?.drawdown ?? buildDrawdownFromEquity(equitySeries, startCapital),
    source,
    drawdownBySleeve,
  }
}
