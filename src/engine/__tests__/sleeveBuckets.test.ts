import { describe, expect, it } from 'vitest'
import { groupDealsIntoBuckets, parseSleeveBucket } from '../sleeveBuckets'
import type { DealRow } from '../types'

const makeDeal = (sleeve: string, symbol: string): DealRow => ({
  deal: `${sleeve}-${symbol}`,
  time: Date.UTC(2026, 0, 1),
  sleeve,
  symbol,
  notional: 1,
  _seq: 0,
})

describe('sleeve buckets', () => {
  it('uses the final bracket tag as the bucket and keeps the strategy name', () => {
    expect(parseSleeveBucket('Daily Capitulation MR [EQ] - SPY')).toEqual({
      name: 'EQ',
      strategy: 'Daily Capitulation MR',
      sleeve: 'Daily Capitulation MR - EQ',
    })
    expect(parseSleeveBucket('Macro - Intraday [ Rates ] — TLT')).toEqual({
      name: 'Rates',
      strategy: 'Macro - Intraday',
      sleeve: 'Macro - Intraday - Rates',
    })
  })

  it('does not group sleeves without a non-empty trailing bracket tag', () => {
    expect(parseSleeveBucket('Daily Capitulation MR - SPY')).toBeNull()
    expect(parseSleeveBucket('Daily [EQ] Capitulation - SPY')).toBeNull()
    expect(parseSleeveBucket('Daily [] - SPY')).toBeNull()
  })

  it('maps bucket deals while retaining deterministic member metadata', () => {
    const first = makeDeal('Daily Capitulation MR [EQ] - SPY', 'SPY')
    const second = makeDeal('Daily Capitulation MR [EQ] - QQQ', 'QQQ')
    const plain = makeDeal('Trend - TLT', 'TLT')
    const grouped = groupDealsIntoBuckets([first, second, plain, { ...first, deal: 'repeat' }])

    expect(grouped.deals.map((deal) => deal.sleeve)).toEqual([
      'Daily Capitulation MR - EQ',
      'Daily Capitulation MR - EQ',
      'Trend - TLT',
      'Daily Capitulation MR - EQ',
    ])
    expect(grouped.membersByBucket.get('Daily Capitulation MR - EQ')).toEqual([
      {
        key: 'Daily Capitulation MR [EQ] - QQQ::QQQ',
        sleeve: 'Daily Capitulation MR [EQ] - QQQ',
        symbol: 'QQQ',
      },
      {
        key: 'Daily Capitulation MR [EQ] - SPY::SPY',
        sleeve: 'Daily Capitulation MR [EQ] - SPY',
        symbol: 'SPY',
      },
    ])
  })
})
