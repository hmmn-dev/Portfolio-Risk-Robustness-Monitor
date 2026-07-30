// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MagicDealRow } from '../../engine/parseDealsWithMagic'
import type { UnderlyingSeries } from '../../engine/types'
import { useReportStore } from '../../store/report'
import { useUnderlyingStore } from '../../store/underlying'
import { useWizardStore } from '../../store/wizard'
import { createReport } from '../../test/reportFixtures'
import { renderWithTheme } from '../../test/render'
import Wizard from '../Wizard'

const { parseDealsMock, parseUnderlyingMock, normalizeUnderlyingMock, buildReportMock } =
  vi.hoisted(() => ({
    parseDealsMock: vi.fn(),
    parseUnderlyingMock: vi.fn(),
    normalizeUnderlyingMock: vi.fn(),
    buildReportMock: vi.fn(),
  }))

vi.mock('../../store/idbStorage', () => ({
  idbStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}))

vi.mock('../../engine/parseDealsWithMagic', () => ({
  parseDealsWithMagic: parseDealsMock,
}))

vi.mock('../../engine/underlying', () => ({
  parseUnderlying: parseUnderlyingMock,
  normalizeUnderlyingSeries: normalizeUnderlyingMock,
}))

vi.mock('../../engine/portfolioSeries', () => ({
  buildPortfolioReport: buildReportMock,
}))

const deal: MagicDealRow = {
  deal: 'D1',
  time: Date.UTC(2024, 0, 1),
  sleeve: 'Alpha - EURUSD',
  notional: 10,
  symbol: 'EURUSD',
  positionId: 1,
  magic: 42,
  entry: 'IN',
  entryComment: 'Alpha',
  pnl: 10,
  _seq: 0,
}

const underlying: UnderlyingSeries = {
  symbol: 'EURUSD',
  timeframe: 'D1',
  candles: [],
  daily: [],
}

const fileWith = (name: string, method: 'arrayBuffer' | 'text', value: ArrayBuffer | string) => {
  const file = new File(['test'], name, { type: 'text/csv' })
  Object.defineProperty(file, method, {
    configurable: true,
    value: vi.fn().mockResolvedValue(value),
  })
  return file
}

describe('Wizard', () => {
  beforeEach(() => {
    useWizardStore.getState().resetWizard()
    useReportStore.setState({
      report: null,
      baseReport: null,
      deals: null,
      baseDeals: null,
      marDegradationPct: null,
      hasHydrated: true,
    })
    useUnderlyingStore.setState({ seriesBySymbol: {}, hasHydrated: true })
    parseDealsMock.mockReset().mockReturnValue([deal])
    parseUnderlyingMock.mockReset().mockReturnValue(underlying)
    normalizeUnderlyingMock.mockReset().mockReturnValue(underlying)
    buildReportMock.mockReset().mockReturnValue(createReport())
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  it('keeps parsing disabled until a deals file is selected and supports removal', async () => {
    const user = userEvent.setup()
    const { container } = renderWithTheme(<Wizard />)
    const parseButton = screen.getByRole('button', { name: 'Parse deals' })
    const dealsInput = container.querySelector('input[type="file"]') as HTMLInputElement

    expect(parseButton).toBeDisabled()
    await user.upload(dealsInput, fileWith('deals.csv', 'arrayBuffer', new ArrayBuffer(4)))

    expect(parseButton).toBeEnabled()
    expect(screen.getByText('deals.csv')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove deals file' }))

    expect(parseButton).toBeDisabled()
    expect(screen.queryByText('deals.csv')).not.toBeInTheDocument()
  })

  it('parses deals and underlying data, then stores the generated report', async () => {
    const user = userEvent.setup()
    const report = createReport()
    buildReportMock.mockReturnValue(report)
    const { container } = renderWithTheme(<Wizard />)

    const dealsInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(dealsInput, fileWith('deals.csv', 'arrayBuffer', new ArrayBuffer(4)))
    await user.click(screen.getByRole('button', { name: 'Parse deals' }))

    expect(await screen.findByText('Upload the underlying file')).toBeInTheDocument()
    expect(
      screen.getByText('Missing candle files for: EURUSD. Upload them to continue.'),
    ).toBeVisible()

    const underlyingInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      underlyingInput,
      fileWith('EURUSD_D1.csv', 'text', 'date,open,high,low,close'),
    )
    await user.click(screen.getByRole('button', { name: 'Parse underlying' }))

    expect(await screen.findByText('Ready to generate')).toBeInTheDocument()
    expect(screen.getByText('All checks passed.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Generate report' }))

    expect(parseDealsMock).toHaveBeenCalledOnce()
    expect(parseUnderlyingMock).toHaveBeenCalledWith(
      'date,open,high,low,close',
      expect.objectContaining({ symbol: 'EURUSD', sourceName: 'EURUSD_D1.csv' }),
    )
    expect(buildReportMock).toHaveBeenCalledWith(
      [deal],
      expect.objectContaining({
        dealsSourceName: 'deals.csv',
        underlyingTimeframes: { EURUSD: 'D1' },
        underlyingSeries: [underlying],
      }),
    )
    expect(useReportStore.getState().report).toBe(report)
    expect(useReportStore.getState().baseReport).toBe(report)
    expect(useReportStore.getState().deals).toEqual([deal])
  })
})
