import { normalizeUnderlyingSeries, parseUnderlying } from '../../engine/underlying'
import type { UnderlyingSeries } from '../../engine/types'
import type { UnderlyingFiles, UnderlyingUploadMode } from './wizardModel'

export const parseUnderlyingFiles = async (
  files: UnderlyingFiles,
  mode: UnderlyingUploadMode,
): Promise<Record<string, UnderlyingSeries>> => {
  const entries: Record<string, UnderlyingSeries> = {}

  for (const [symbolKey, file] of Object.entries(files)) {
    const parsed = parseUnderlying(await file.text(), {
      symbol: mode === 'perSymbol' ? symbolKey : undefined,
      sourceName: file.name,
    })
    const symbol = parsed.symbol || symbolKey.toUpperCase()
    const existing = entries[symbol]
    entries[symbol] = existing
      ? normalizeUnderlyingSeries(symbol, [...existing.candles, ...parsed.candles])
      : parsed
  }

  return entries
}
