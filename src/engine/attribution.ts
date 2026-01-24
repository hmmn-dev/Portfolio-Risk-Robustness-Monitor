import type { DealRow, SleeveKey } from './types'

export const computeAttribution = (deals: DealRow[]): Record<SleeveKey, number> => {
  return deals.reduce<Record<SleeveKey, number>>((acc, deal) => {
    acc[deal.sleeve] = (acc[deal.sleeve] ?? 0) + deal.notional
    return acc
  }, {})
}
