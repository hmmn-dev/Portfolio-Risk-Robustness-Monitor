import { describe, expect, it } from 'vitest'
import type { MagicDealRow } from '../../../engine/parseDealsWithMagic'
import {
  buildUnderlyingTimeframes,
  getDealSymbols,
  getGenerationIssues,
  getLoadingState,
  getMissingSymbols,
  parseSymbolFromFilename,
} from '../wizardModel'

const deal = (symbol: string): MagicDealRow =>
  ({
    symbol,
  }) as MagicDealRow

describe('wizard model', () => {
  it('derives sorted unique symbols and missing uploads', () => {
    const symbols = getDealSymbols([deal('USDJPY'), deal('EURUSD'), deal('USDJPY'), deal('')])
    const eurUsd = new File(['data'], 'EURUSD_D1.csv')

    expect(symbols).toEqual(['EURUSD', 'USDJPY'])
    expect(getMissingSymbols(symbols, { EURUSD: eurUsd })).toEqual(['USDJPY'])
  })

  it('derives symbols from supported bulk file names', () => {
    expect(parseSymbolFromFilename('XAUUSD_H1_201801.csv')).toBe('XAUUSD')
    expect(parseSymbolFromFilename('EURUSD-D1.csv')).toBe('EURUSD')
    expect(parseSymbolFromFilename('GBPUSD_history.csv')).toBe('GBPUSD')
    expect(parseSymbolFromFilename('')).toBe('')
  })

  it('reports every generation prerequisite that is still missing', () => {
    expect(
      getGenerationIssues({
        hasDealsFile: false,
        parsedDealCount: 0,
        symbols: [],
        missingSymbols: ['EURUSD'],
      }),
    ).toEqual([
      'Deals file is missing.',
      'Deals are not parsed yet.',
      'No symbols detected from deals.',
      'Missing candle files for: EURUSD',
    ])
    expect(
      getGenerationIssues({
        hasDealsFile: true,
        parsedDealCount: 1,
        symbols: ['EURUSD'],
        missingSymbols: [],
      }),
    ).toEqual([])
  })

  it('maps loading and timeframe state into view-ready values', () => {
    expect(
      getLoadingState({
        parsingDeals: false,
        parsingUnderlying: true,
        computingReport: false,
      }),
    ).toEqual({ isLoading: true, message: 'Parsing underlying file...' })
    expect(
      buildUnderlyingTimeframes({
        EURUSD: {
          symbol: 'EURUSD',
          timeframe: 'D1',
          candles: [],
          daily: [],
        },
      }),
    ).toEqual({ EURUSD: 'D1' })
  })
})
