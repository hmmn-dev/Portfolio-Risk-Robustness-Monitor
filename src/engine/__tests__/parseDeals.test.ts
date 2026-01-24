import { describe, expect, it } from 'vitest'
import { parseDeals } from '../parseDeals'

const csv = `
deal,time,sleeve,notional
ALPHA,2,Core,100
ALPHA,1,Core,50
ALPHA,1,Core,75
BETA,1,Opportunistic,30
`

describe('parseDeals', () => {
  it('sorts by time then deal', () => {
    const rows = parseDeals(csv)
    expect(rows.map((row) => `${row.time}-${row.deal}`)).toEqual([
      '1-ALPHA',
      '1-ALPHA',
      '1-BETA',
      '2-ALPHA',
    ])
  })

  it('uses _seq as fallback for deals.csv', () => {
    const rows = parseDeals(csv, { sourceName: 'deals.csv' })
    const seqs = rows.filter((row) => row.time === 1 && row.deal === 'ALPHA').map((row) => row._seq)
    expect(seqs).toEqual([1, 2])
  })
})
