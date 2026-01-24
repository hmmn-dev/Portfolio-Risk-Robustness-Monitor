import { stableSort } from './stableSort'
import type { DealRow } from './types'

export const obfuscateDealIds = (deals: DealRow[]): DealRow[] => {
  const uniqueDeals = stableSort(
    Array.from(new Set(deals.map((deal) => deal.deal))),
    (a, b) => a.localeCompare(b)
  )

  const map = new Map<string, string>()
  uniqueDeals.forEach((deal, index) => {
    map.set(deal, `DEAL-${String(index + 1).padStart(4, '0')}`)
  })

  return deals.map((deal) => ({
    ...deal,
    deal: map.get(deal.deal) ?? deal.deal,
  }))
}
