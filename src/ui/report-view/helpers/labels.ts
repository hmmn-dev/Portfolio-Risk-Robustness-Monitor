import { stableSort } from '../../../engine/stableSort'

export const splitSleeveLabel = (label: string) => {
  const separator = label.includes(' — ') ? ' — ' : ' - '
  const parts = label.split(separator)
  if (parts.length < 2) return { sleeve: label, symbol: '' }
  return { sleeve: parts.slice(0, -1).join(separator), symbol: parts[parts.length - 1] }
}

export const buildSleeveKey = (sleeve: string, symbol: string) =>
  `${sleeve.trim()}||${symbol.trim()}`

export const buildObfuscationMap = (values: string[], prefix: string) => {
  const uniqueValues = stableSort(
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))),
    (a, b) => a.localeCompare(b),
  )
  const map = new Map<string, string>()
  uniqueValues.forEach((value, index) => {
    map.set(value, `${prefix}-${String(index + 1).padStart(2, '0')}`)
  })
  return map
}

export const normalizeSymbol = (value: string) => {
  let symbol = value.trim().toUpperCase()
  symbol = symbol.replace(/[^A-Z0-9]/g, '')
  symbol = symbol.replace(/^(FX|FX_)/, '')
  symbol = symbol.replace(/(PRO|RAW|M)$/, '')
  return symbol
}
