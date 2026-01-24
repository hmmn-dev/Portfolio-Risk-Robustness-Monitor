import { stableSort } from './stableSort'
import type { DealRow } from './types'

type ParseDealsOptions = {
  sourceName?: string
}

const toNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseCsv = (text: string) =>
  text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim()))

export const parseDeals = (text: string, options: ParseDealsOptions = {}): DealRow[] => {
  const rows = parseCsv(text)
  if (rows.length === 0) return []

  const header = rows[0].map((cell) => cell.toLowerCase())
  const dealIndex = header.indexOf('deal')
  const timeIndex = header.indexOf('time')
  const sleeveIndex = header.indexOf('sleeve')
  const notionalIndex = header.indexOf('notional')
  const balanceIndex = header.indexOf('balance')

  const parsed = rows.slice(1).map((row, index): DealRow => {
    const deal = row[dealIndex] ?? ''
    const time = toNumber(row[timeIndex] ?? '')
    const sleeve = row[sleeveIndex] ?? ''
    const notional = toNumber(row[notionalIndex] ?? '')
    const balance = balanceIndex >= 0 ? toNumber(row[balanceIndex] ?? '') : undefined

    return {
      deal,
      time,
      sleeve,
      notional,
      balance,
      _seq: index,
    }
  })

  return stableSort(parsed, (a, b) => {
    const byTime = a.time - b.time
    if (byTime) return byTime
    const byDeal = a.deal.localeCompare(b.deal)
    if (byDeal) return byDeal
    return options.sourceName === 'deals.csv' ? a._seq - b._seq : 0
  })
}
