import { stableSort } from './stableSort'
import type { DealRow } from './types'

export type MagicDealRow = DealRow & {
  symbol: string
  positionId: number
  magic: number
  entry: string
  entryComment: string
  pnl: number
}

const toNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseTime = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const numeric = Number(trimmed)
  if (Number.isFinite(numeric)) {
    if (numeric > 1e12) return numeric
    if (numeric > 1e9) return numeric * 1000
    return numeric
  }
  const [datePart, timePart = '00:00:00'] = trimmed.split(' ')
  const dateMatch =
    datePart.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/) ||
    datePart.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateMatch) {
    const year = Number(dateMatch[1])
    const month = Number(dateMatch[2]) - 1
    const day = Number(dateMatch[3])
    const timeMatch =
      timePart.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/) ||
      timePart.match(/^(\d{2})(\d{2})(\d{2})?$/)
    const hours = timeMatch ? Number(timeMatch[1]) : 0
    const minutes = timeMatch ? Number(timeMatch[2]) : 0
    const seconds = timeMatch && timeMatch[3] ? Number(timeMatch[3]) : 0
    return Date.UTC(year, month, day, hours, minutes, seconds)
  }
  const parsed = Date.parse(trimmed)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseCsv = (text: string) =>
  text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(';').map((cell) => cell.trim()))

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export const parseDealsWithMagic = (
  buffer: ArrayBuffer,
  options: { defaultSleeve?: string } = {}
): MagicDealRow[] => {
  const fallbackSleeve = options.defaultSleeve?.trim()
  const decoder = new TextDecoder('utf-16le')
  const rawText = decoder.decode(buffer).replace(/^\uFEFF/, '')
  const rows = parseCsv(rawText)
  if (rows.length === 0) return []

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const indexOf = (name: string) => header.indexOf(name)
  const dealIndex = indexOf('deal')
  const ticketIndex = indexOf('ticket')
  const orderIndex = indexOf('order')
  const timeIndex = indexOf('time')
  const symbolIndex = indexOf('symbol')
  const positionIdIndex = indexOf('position_id')
  const magicIndex = indexOf('magic')
  const entryIndex = indexOf('entry')
  const entryCommentIndex = header.findIndex((cell) =>
    ['entrycomment', 'entry_comment', 'comment'].includes(cell)
  )
  const sideIndex = header.findIndex((cell) => ['side', 'type', 'direction'].includes(cell))
  const priceIndex = header.findIndex((cell) =>
    ['price', 'deal_price', 'entry_price', 'exit_price'].includes(cell)
  )
  const volumeIndex = indexOf('volume')
  const profitIndex = indexOf('profit')
  const commissionIndex = indexOf('commission')
  const swapIndex = indexOf('swap')
  const balanceIndex = indexOf('balance')

  const parsed = rows.slice(1).map((row, index): MagicDealRow => {
    const deal =
      row[dealIndex] ?? row[ticketIndex] ?? row[orderIndex] ?? row[positionIdIndex] ?? `${index}`
    const time = parseTime(row[timeIndex] ?? '')
    const symbol = row[symbolIndex] ?? ''
    const positionId = toNumber(row[positionIdIndex] ?? '')
    const magic = toNumber(row[magicIndex] ?? '')
    const entry = row[entryIndex] ?? ''
    const entryComment = row[entryCommentIndex] ?? ''
    const sideRaw = sideIndex >= 0 ? row[sideIndex] ?? '' : ''
    const side = sideRaw.trim().toLowerCase()
    const sideValue =
      side === 'buy' || side === 'long'
        ? 'buy'
        : side === 'sell' || side === 'short'
          ? 'sell'
          : undefined
    const price = priceIndex >= 0 ? toNumber(row[priceIndex] ?? '') : undefined
    const volume = volumeIndex >= 0 ? toNumber(row[volumeIndex] ?? '') : undefined
    const profit = toNumber(row[profitIndex] ?? '')
    const commission = toNumber(row[commissionIndex] ?? '')
    const swap = toNumber(row[swapIndex] ?? '')
    const balance = balanceIndex >= 0 ? toNumber(row[balanceIndex] ?? '') : undefined
    const pnl = profit + commission + swap

    return {
      deal: String(deal),
      time,
      sleeve: '',
      notional: pnl,
      balance,
      _seq: index,
      symbol,
      positionId,
      magic,
      entry,
      entryComment,
      price,
      side: sideValue,
      volume,
      profit,
      commission,
      swap,
      pnl,
    }
  })

  const hasStringEntry = parsed.some((row) => {
    const value = row.entry.trim()
    return value.length > 0 && !Number.isFinite(Number(value))
  })

  let entryValue: number | null = null
  if (!hasStringEntry) {
    const grouped = new Map<number, number[]>()
    parsed.forEach((row) => {
      const value = Number(row.entry.trim())
      if (!Number.isFinite(value)) return
      const list = grouped.get(value) ?? []
      list.push(Math.abs(row.pnl))
      grouped.set(value, list)
    })

    let bestMedian = Number.POSITIVE_INFINITY
    grouped.forEach((values, value) => {
      const med = median(values)
      if (med < bestMedian) {
        bestMedian = med
        entryValue = value
      }
    })
  }

  const isEntryRow = (row: MagicDealRow) => {
    if (hasStringEntry) {
      return row.entry.trim().toUpperCase() === 'IN'
    }
    if (entryValue === null) return false
    const value = Number(row.entry.trim())
    return Number.isFinite(value) && value === entryValue
  }

  const getEntryType = (row: MagicDealRow): 'in' | 'out' | 'unknown' => {
    const raw = row.entry.trim().toUpperCase()
    if (hasStringEntry) {
      if (raw === 'IN') return 'in'
      if (raw === 'OUT') return 'out'
      return 'unknown'
    }
    if (entryValue === null) return 'unknown'
    const value = Number(row.entry.trim())
    if (!Number.isFinite(value)) return 'unknown'
    return value === entryValue ? 'in' : 'out'
  }

  const sorted = stableSort(parsed, (a, b) => {
    const byTime = a.time - b.time
    if (byTime) return byTime
    return a.deal.localeCompare(b.deal)
  })

  const keyForRow = (row: MagicDealRow) => {
    if (row.positionId && row.positionId !== 0) {
      return `${row.symbol}::${row.positionId}`
    }
    return `${row.symbol}::magic::${row.magic}`
  }

  const commentByKey = new Map<string, string>()
  sorted.forEach((row) => {
    if (!isEntryRow(row)) return
    const comment = row.entryComment.trim()
    if (!comment) return
    const key = keyForRow(row)
    if (!commentByKey.has(key)) {
      commentByKey.set(key, comment)
    }
  })

  return sorted.map((row) => {
    const key = keyForRow(row)
    const comment = commentByKey.get(key) ?? fallbackSleeve ?? 'UNSPECIFIED'
    return {
      ...row,
      entryComment: comment,
      sleeve: `${comment} - ${row.symbol}`,
      entryType: getEntryType(row),
    }
  })
}
