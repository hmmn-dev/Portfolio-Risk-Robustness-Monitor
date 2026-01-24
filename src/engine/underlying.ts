import { stableSort } from './stableSort'
import type { UnderlyingCandle, UnderlyingDailyReturn, UnderlyingSeries } from './types'

type ParseUnderlyingOptions = {
  symbol?: string
  sourceName?: string
}

type Candle = UnderlyingCandle

const toNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseTime = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const [datePart, timePart = '00:00'] = trimmed.split(' ')
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

export const normalizeSymbol = (value: string) => {
  let symbol = value.trim().toUpperCase()
  symbol = symbol.replace(/[^A-Z0-9]/g, '')
  symbol = symbol.replace(/^(FX|FX_)/, '')
  symbol = symbol.replace(/(PRO|RAW|M)$/, '')
  return symbol
}

const inferSymbolFromName = (name: string) => {
  const match = name.match(/^([A-Za-z0-9]+)[_-](H1|D1)/)
  if (match) return match[1]
  const parts = name.split('_')
  return parts[0] || ''
}

const detectDelimiter = (line: string) => {
  if (line.includes('\t')) return '\t'
  if (line.includes(';')) return ';'
  return ','
}

const parseCsv = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return []
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = detectDelimiter(lines[0])
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()))
}

const toDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const aggregateToDaily = (candles: Candle[]) => {
  const byDay = new Map<number, Candle[]>()
  candles.forEach((candle) => {
    const day = toDayStart(candle.time)
    const list = byDay.get(day) ?? []
    list.push(candle)
    byDay.set(day, list)
  })

  return stableSort(Array.from(byDay.entries()), (a, b) => a[0] - b[0]).map(([day, list]) => {
    const sorted = stableSort(list, (a, b) => a.time - b.time)
    const open = sorted[0].open
    const close = sorted[sorted.length - 1].close
    const high = Math.max(...sorted.map((item) => item.high))
    const low = Math.min(...sorted.map((item) => item.low))
    return {
      time: day,
      open,
      high,
      low,
      close,
    }
  })
}

const buildDailyReturns = (symbol: string, dailyCandles: Candle[]) => {
  const returns: UnderlyingDailyReturn[] = []
  for (let i = 0; i < dailyCandles.length; i += 1) {
    const candle = dailyCandles[i]
    const prevClose = i === 0 ? Number.NaN : dailyCandles[i - 1].close
    const ret =
      Number.isFinite(prevClose) && prevClose !== 0 ? candle.close / prevClose - 1 : Number.NaN
    returns.push({
      symbol,
      time: candle.time,
      close: candle.close,
      return: ret,
    })
  }
  return returns
}

export const normalizeUnderlyingSeries = (symbol: string, candles: Candle[]): UnderlyingSeries => {
  const sortedCandles = stableSort(
    candles.filter((candle) => candle.time > 0),
    (a, b) => a.time - b.time
  )
  const deltas = sortedCandles.slice(1).map((candle, idx) => candle.time - sortedCandles[idx].time)
  const medianDelta = deltas.length
    ? stableSort(deltas, (a, b) => a - b)[Math.floor(deltas.length / 2)]
    : 0
  const isHourly = medianDelta > 0 && medianDelta <= 2 * 60 * 60 * 1000
  const timeframe: UnderlyingSeries['timeframe'] = isHourly ? 'H1' : 'D1'
  const dailyCandles = isHourly ? aggregateToDaily(sortedCandles) : sortedCandles

  return {
    symbol: normalizeSymbol(symbol || 'UNSPECIFIED'),
    timeframe,
    candles: sortedCandles,
    daily: buildDailyReturns(normalizeSymbol(symbol || 'UNSPECIFIED'), dailyCandles),
  }
}

export const parseUnderlying = (
  text: string,
  options: ParseUnderlyingOptions = {}
): UnderlyingSeries => {
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return {
      symbol: normalizeSymbol(options.symbol ?? options.sourceName ?? 'UNSPECIFIED'),
      timeframe: 'D1',
      candles: [],
      daily: [],
    }
  }

  const header = rows[0].map((cell) => cell.toLowerCase())
  const normalizedHeader = header.map((cell) => cell.replace(/[^a-z0-9]/g, ''))
  const timeIndex = normalizedHeader.indexOf('time')
  const dateIndex = normalizedHeader.indexOf('date')
  const openIndex = normalizedHeader.indexOf('open')
  const highIndex = normalizedHeader.indexOf('high')
  const lowIndex = normalizedHeader.indexOf('low')
  const closeIndex = normalizedHeader.indexOf('close')
  const symbolIndex = normalizedHeader.indexOf('symbol')

  const candles: Candle[] = rows
    .slice(1)
    .map((row) => {
      const timeValue =
        timeIndex >= 0 && dateIndex >= 0
          ? `${row[dateIndex] ?? ''} ${row[timeIndex] ?? ''}`.trim()
          : row[timeIndex] ?? row[dateIndex] ?? ''
      return {
        time: parseTime(timeValue),
        open: toNumber(row[openIndex] ?? ''),
        high: toNumber(row[highIndex] ?? ''),
        low: toNumber(row[lowIndex] ?? ''),
        close: toNumber(row[closeIndex] ?? ''),
      }
    })
    .filter((candle) => candle.time > 0)

  const symbolValue =
    options.symbol ||
    (symbolIndex >= 0 ? rows[1]?.[symbolIndex] ?? '' : '') ||
    (options.sourceName ? inferSymbolFromName(options.sourceName) : '')
  return normalizeUnderlyingSeries(symbolValue || 'UNSPECIFIED', candles)
}
