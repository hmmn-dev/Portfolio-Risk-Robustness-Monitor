import { stableSort } from './stableSort'
import type { DealRow } from './types'
import { getDealSymbol } from './portfolioSeriesHelpers'

export type SleeveBucket = {
  name: string
  strategy: string
  sleeve: string
}

export type BucketMember = {
  key: string
  sleeve: string
  symbol: string
}

const splitSleeveComment = (sleeve: string) => {
  const emDashIndex = sleeve.lastIndexOf(' — ')
  const hyphenIndex = sleeve.lastIndexOf(' - ')
  const separatorIndex = Math.max(emDashIndex, hyphenIndex)
  return separatorIndex >= 0 ? sleeve.slice(0, separatorIndex).trim() : sleeve.trim()
}

export const parseSleeveBucket = (sleeve: string): SleeveBucket | null => {
  const comment = splitSleeveComment(sleeve)
  if (!comment.endsWith(']')) return null
  const bracketStart = comment.lastIndexOf('[')
  if (bracketStart < 0) return null

  const strategy = comment.slice(0, bracketStart).trim()
  const name = comment.slice(bracketStart + 1, -1).trim()
  if (!strategy || !name || name.includes('[') || name.includes(']')) return null

  return {
    name,
    strategy,
    sleeve: `${strategy} - ${name}`,
  }
}

export const groupDealsIntoBuckets = (deals: DealRow[]) => {
  const bucketSleeves = new Set<string>()
  const membersByBucket = new Map<string, BucketMember[]>()
  const memberKeysByBucket = new Map<string, Set<string>>()
  let hasBuckets = false

  const groupedDeals = deals.map((deal) => {
    const bucket = parseSleeveBucket(deal.sleeve)
    if (!bucket) return deal

    hasBuckets = true
    bucketSleeves.add(bucket.sleeve)
    const symbol = getDealSymbol(deal)
    const memberKey = `${deal.sleeve}::${symbol}`
    const memberKeys = memberKeysByBucket.get(bucket.sleeve) ?? new Set<string>()
    if (!memberKeys.has(memberKey)) {
      const members = membersByBucket.get(bucket.sleeve) ?? []
      members.push({ key: memberKey, sleeve: deal.sleeve, symbol })
      membersByBucket.set(bucket.sleeve, members)
      memberKeys.add(memberKey)
      memberKeysByBucket.set(bucket.sleeve, memberKeys)
    }

    return { ...deal, sleeve: bucket.sleeve }
  })

  membersByBucket.forEach((members, sleeve) => {
    membersByBucket.set(
      sleeve,
      stableSort(
        members,
        (a, b) => a.sleeve.localeCompare(b.sleeve) || a.symbol.localeCompare(b.symbol),
      ),
    )
  })

  return { deals: groupedDeals, bucketSleeves, membersByBucket, hasBuckets }
}
