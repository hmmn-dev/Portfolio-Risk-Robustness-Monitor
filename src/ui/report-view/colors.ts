import { alpha, lighten } from '@mui/material/styles'

const symbolPalette = [
  '#1976d2',
  '#0288d1',
  '#0097a7',
  '#00796b',
  '#388e3c',
  '#f57c00',
  '#e64a19',
  '#c2185b',
  '#7b1fa2',
  '#512da8',
]

const hashSymbol = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const getSymbolChipStyles = (symbol: string, isDark: boolean) => {
  const idx = symbol ? hashSymbol(symbol) % symbolPalette.length : 0
  const base = symbolPalette[idx]
  const toned = isDark ? lighten(base, 0.45) : base
  return {
    backgroundColor: 'transparent',
    color: isDark ? toned : base,
    border: `1px solid ${isDark ? alpha(toned, 0.7) : alpha(base, 0.9)}`,
  }
}

export const heatmapPalette = ['#0c1c2d', '#1b3b5f', '#2f6b7a', '#4ea79a', '#b9e29b', '#f6e37a']

const interpolateChannel = (start: number, end: number, ratio: number) =>
  Math.round(start + (end - start) * ratio)

const interpolateColor = (start: string, end: string, ratio: number) => {
  const s = start.replace('#', '')
  const e = end.replace('#', '')
  const sr = parseInt(s.slice(0, 2), 16)
  const sg = parseInt(s.slice(2, 4), 16)
  const sb = parseInt(s.slice(4, 6), 16)
  const er = parseInt(e.slice(0, 2), 16)
  const eg = parseInt(e.slice(2, 4), 16)
  const eb = parseInt(e.slice(4, 6), 16)
  const r = interpolateChannel(sr, er, ratio)
  const g = interpolateChannel(sg, eg, ratio)
  const b = interpolateChannel(sb, eb, ratio)
  return `rgb(${r}, ${g}, ${b})`
}

export const isLightColor = (color: string) => {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return false
  const r = Number(match[1])
  const g = Number(match[2])
  const b = Number(match[3])
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.6
}

export const correlationColor = (value: number | null) => {
  if (value == null) return 'transparent'
  const t = Math.min(1, Math.max(0, (value + 1) / 2))
  const step = 1 / (heatmapPalette.length - 1)
  const idx = Math.min(heatmapPalette.length - 2, Math.floor(t / step))
  const local = (t - idx * step) / step
  return interpolateColor(heatmapPalette[idx], heatmapPalette[idx + 1], local)
}
