export const formatAxisDate = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: '2-digit' })
}

export const formatAxisNumber = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : ''

export const formatSigned = (value: number, digits = 2, suffix = '') => {
  if (!Number.isFinite(value)) return 'n/a'
  return `${value.toFixed(digits)}${suffix}`
}

export const formatNumber = (value: number | null | undefined, digits = 2) =>
  Number.isFinite(value) ? (value as number).toFixed(digits) : '-'

export const formatCurrency = (value: number | null | undefined) =>
  Number.isFinite(value)
    ? (value as number).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '-'

export const formatPercent = (value: number | null | undefined, digits = 2) =>
  Number.isFinite(value) ? `${(value as number).toFixed(digits)}%` : '-'

export const formatRate = (value: number | null | undefined, digits = 1) =>
  Number.isFinite(value) ? `${((value as number) * 100).toFixed(digits)}%` : '-'

export const formatDrawdownSourceLabel = (source?: 'H1' | 'D1') => `${source ?? 'D1'} candles`

export const formatDrawdownModeLabel = (mode: 'deal' | 'mtm') =>
  mode === 'mtm' ? 'In-Trade' : 'Realized'
