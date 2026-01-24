import { describe, expect, it } from 'vitest'
import { parseDealsWithMagic } from '../parseDealsWithMagic'

const makeBuffer = (text: string) => Buffer.from(text, 'utf16le')

describe('parseDealsWithMagic', () => {
  it('handles empty comments and missing position_id with magic fallback', () => {
    const csv = `\uFEFFtime;deal;symbol;position_id;magic;entry;entrycomment;profit;commission;swap
2024-01-02;A1;EURUSD;0;42;0;;10;-1;0
2024-01-01;A0;EURUSD;0;42;0;Core Sleeve;5;0;0
2024-01-03;A2;EURUSD;0;42;1;;-2;0;0`

    const rows = parseDealsWithMagic(makeBuffer(csv))
    expect(rows[0].entryComment).toBe('Core Sleeve')
    expect(rows[0].sleeve).toBe('Core Sleeve - EURUSD')
    expect(rows[2].entryComment).toBe('Core Sleeve')
  })

  it('keeps sleeve attribution scoped to symbol', () => {
    const csv = `time;deal;symbol;position_id;magic;entry;entrycomment;profit;commission;swap
2024-01-01;B0;EURUSD;101;1;IN;Alpha Sleeve;5;0;0
2024-01-01;B1;USDJPY;101;1;IN;Alpha Sleeve;3;0;0
2024-01-02;B2;EURUSD;101;1;OUT;0;0;0`

    const rows = parseDealsWithMagic(makeBuffer(csv))
    const eur = rows.find((row) => row.symbol === 'EURUSD' && row.deal === 'B2')
    const jpy = rows.find((row) => row.symbol === 'USDJPY')
    expect(eur?.sleeve).toBe('Alpha Sleeve - EURUSD')
    expect(jpy?.sleeve).toBe('Alpha Sleeve - USDJPY')
  })

  it('detects numeric entry value by smallest median abs pnl', () => {
    const csv = `time;deal;symbol;position_id;magic;entry;entrycomment;profit;commission;swap
2024-01-01;C0;XAUUSD;200;7;0;Metal;1;0;0
2024-01-02;C1;XAUUSD;200;7;0;Metal;2;0;0
2024-01-03;C2;XAUUSD;200;7;1;Metal;10;0;0
2024-01-04;C3;XAUUSD;200;7;1;Metal;12;0;0`

    const rows = parseDealsWithMagic(makeBuffer(csv))
    const entryRows = rows.filter((row) => row.entry.trim() === '0')
    expect(entryRows.every((row) => row.entryComment === 'Metal')).toBe(true)
  })
})
