import type { MagicDealRow } from '../../engine/parseDealsWithMagic'
import type { UnderlyingSeries } from '../../engine/types'

export type UnderlyingUploadMode = 'perSymbol' | 'bulk'
export type UnderlyingFiles = Record<string, File>

type WizardLoading = {
  parsingDeals: boolean
  parsingUnderlying: boolean
  computingReport: boolean
}

const LOADING_MESSAGES: Record<keyof WizardLoading, string> = {
  parsingDeals: 'Parsing deals file...',
  parsingUnderlying: 'Parsing underlying file...',
  computingReport: 'Computing report...',
}

export const getDealSymbols = (deals: MagicDealRow[]) =>
  Array.from(
    deals.reduce((symbols, deal) => {
      if (deal.symbol) symbols.add(deal.symbol)
      return symbols
    }, new Set<string>()),
  ).sort((a, b) => a.localeCompare(b))

export const parseSymbolFromFilename = (filename: string) => {
  const match = filename.match(/^([A-Za-z0-9]+)[_-](H1|D1)/)
  if (match) return match[1]
  return filename.split('_')[0] || ''
}

export const getMissingSymbols = (symbols: string[], files: UnderlyingFiles) =>
  symbols.filter((symbol) => !files[symbol])

export const getGenerationIssues = ({
  hasDealsFile,
  parsedDealCount,
  symbols,
  missingSymbols,
}: {
  hasDealsFile: boolean
  parsedDealCount: number
  symbols: string[]
  missingSymbols: string[]
}) => {
  const issues: string[] = []
  if (!hasDealsFile) issues.push('Deals file is missing.')
  if (parsedDealCount === 0) issues.push('Deals are not parsed yet.')
  if (symbols.length === 0) issues.push('No symbols detected from deals.')
  if (missingSymbols.length > 0) {
    issues.push(`Missing candle files for: ${missingSymbols.join(', ')}`)
  }
  return issues
}

export const getLoadingState = (loading: WizardLoading) => {
  const activeKey = (Object.keys(loading) as Array<keyof WizardLoading>).find((key) => loading[key])
  return {
    isLoading: activeKey != null,
    message: activeKey ? LOADING_MESSAGES[activeKey] : '',
  }
}

export const buildUnderlyingTimeframes = (
  seriesBySymbol: Record<string, UnderlyingSeries>,
): Record<string, 'H1' | 'D1'> =>
  Object.fromEntries(
    Object.entries(seriesBySymbol).map(([symbol, series]) => [symbol, series.timeframe]),
  )
