import {
  benchmarkRelationship,
  type BenchmarkRelationship,
  type RelationshipFrequency,
} from '../../../engine/benchmarkRelationships'
import { toDayStart } from '../../../engine/portfolioSeriesHelpers'
import type { ContributionSeries, DailyPoint, UnderlyingSeries } from '../../../engine/types'
import { normalizeSymbol } from '../helpers/labels'

export type FactorRelationshipRow = BenchmarkRelationship & { symbol: string }
export type FactorRelationships = Record<
  'portfolio' | 'symbols',
  Record<RelationshipFrequency, FactorRelationshipRow[]>
>

export const buildFactorRelationships = ({
  portfolioReturns,
  contributions,
  rawContributions = contributions,
  weights,
  underlying,
}: {
  portfolioReturns: DailyPoint[]
  contributions: ContributionSeries[]
  rawContributions?: ContributionSeries[]
  weights: Record<string, number>
  underlying: UnderlyingSeries[]
}): FactorRelationships => {
  const rawByKey = new Map(rawContributions.map((item) => [item.key, item]))
  const symbolMembers = new Map<string, { returns: Map<number, number>; weight: number }[]>()
  const rangeTimes = portfolioReturns.map((point) => toDayStart(point.time)).filter(Number.isFinite)
  const start = rangeTimes.length ? Math.min(...rangeTimes) : Infinity
  const end = rangeTimes.length ? Math.max(...rangeTimes) : -Infinity
  for (const selected of contributions) {
    const weight = weights[selected.sleeve] ?? 1
    if (weight === 0) continue
    const members = selected.grouping
      ? selected.grouping.members.map(
          (member) => rawByKey.get(member.key) ?? { symbol: member.symbol, returns: [] },
        )
      : [selected]
    for (const member of members) {
      const symbol = normalizeSymbol(member.symbol)
      if (!symbol) continue
      const members = symbolMembers.get(symbol) ?? []
      members.push({
        weight,
        returns: new Map(member.returns.map((point) => [toDayStart(point.time), point.value])),
      })
      symbolMembers.set(symbol, members)
    }
  }
  const bySymbol = new Map(
    Array.from(symbolMembers, ([symbol, members]) => [
      symbol,
      Array.from(new Set(rangeTimes), (time) => ({
        time,
        // An absent constituent is unknown, not a zero-return position.
        value: members.reduce(
          (sum, member) => sum + (member.returns.get(time) ?? NaN) * member.weight,
          0,
        ),
      })),
    ]),
  )
  const benchmarks = new Map<string, DailyPoint[]>()
  // Match the report's canonical first imported series for normalized symbol aliases.
  for (const series of underlying) {
    const symbol = normalizeSymbol(series.symbol)
    if (!symbol || benchmarks.has(symbol)) continue
    benchmarks.set(
      symbol,
      series.daily
        .filter((point) => point.time >= start && point.time <= end)
        .map((point) => ({ time: point.time, value: point.return })),
    )
  }
  const symbols = Array.from(new Set([...benchmarks.keys(), ...bySymbol.keys()])).sort((a, b) =>
    a.localeCompare(b),
  )
  const build = (scope: 'portfolio' | 'symbols', frequency: RelationshipFrequency) =>
    symbols
      .filter((symbol) => scope === 'portfolio' || bySymbol.has(symbol))
      .map((symbol) => ({
        symbol,
        ...benchmarkRelationship(
          scope === 'portfolio' ? portfolioReturns : (bySymbol.get(symbol) ?? []),
          benchmarks.get(symbol) ?? [],
          frequency,
        ),
      }))
  return {
    portfolio: { daily: build('portfolio', 'daily'), monthly: build('portfolio', 'monthly') },
    symbols: { daily: build('symbols', 'daily'), monthly: build('symbols', 'monthly') },
  }
}
