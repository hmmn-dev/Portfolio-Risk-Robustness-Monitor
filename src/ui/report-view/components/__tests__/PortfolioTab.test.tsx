import { buildPortfolioReport } from '../../../../engine/portfolioSeries'
import { useReportAnalytics } from '../../hooks/useReportAnalytics'
// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import type { AppliedPortfolioComposition } from '../../hooks/usePortfolioComposition'
import { usePortfolioViewModel } from '../../hooks/usePortfolioViewModel'
import PortfolioTab from '../PortfolioTab'
import type { ReportViewContextValues } from '../ReportViewContext'
import ReportViewProvider from '../ReportViewProvider'

const chartRenderSpies = vi.hoisted(() => ({
  equity: vi.fn(),
  drawdown: vi.fn(),
}))

vi.mock('../../charts', () => ({
  EquityChart: () => {
    chartRenderSpies.equity()
    return <div data-testid="equity-chart" />
  },
  DrawdownChart: () => {
    chartRenderSpies.drawdown()
    return <div data-testid="drawdown-chart" />
  },
}))

const PortfolioTabHarness = ({ value }: { value: ReportViewContextValues }) => {
  const viewModel = usePortfolioViewModel(value.portfolio)
  return (
    <ReportViewProvider value={value}>
      <PortfolioTab viewModel={viewModel} />
    </ReportViewProvider>
  )
}

const StatefulPortfolioTab = () => {
  const [appliedComposition, setAppliedComposition] = useState<AppliedPortfolioComposition | null>(
    null,
  )
  const value = createReportContext({
    appliedComposition,
    onApplyComposition: setAppliedComposition,
    onResetComposition: () => setAppliedComposition(null),
  })

  return <PortfolioTabHarness value={value} />
}

const candleDay = (offset: number) => Date.UTC(2024, 0, 1 + offset)
const coverageDeals = [
  {
    deal: '1',
    time: candleDay(0),
    sleeve: 'Core',
    symbol: 'EURUSD',
    entryType: 'in' as const,
    side: 'buy' as const,
    price: 100,
    volume: 1,
    positionId: 1,
    notional: 0,
    balance: 1000,
    equity: 1000,
    _seq: 0,
  },
  {
    deal: '2',
    time: candleDay(1),
    sleeve: 'Core',
    symbol: 'EURUSD',
    notional: 0,
    balance: 1000,
    equity: 995,
    _seq: 1,
  },
  {
    deal: '4',
    time: candleDay(3) + 3600000,
    sleeve: 'Core',
    symbol: 'EURUSD',
    entryType: 'out' as const,
    price: 90,
    volume: 1,
    positionId: 1,
    profit: -10,
    notional: -10,
    balance: 990,
    equity: 990,
    _seq: 3,
  },
]
const coverageUnderlying = {
  EURUSD: {
    symbol: 'EURUSD',
    timeframe: 'D1' as const,
    candles: [
      { time: candleDay(1), open: 95, high: 95, low: 95, close: 95 },
      { time: candleDay(2), open: 90, high: 90, low: 90, close: 90 },
    ],
    daily: [],
  },
}
const coverageReport = buildPortfolioReport(coverageDeals, {
  initialCapital: 1000,
  underlyingSeries: Object.values(coverageUnderlying),
})

const DrawdownSourceHarness = ({ cached = false }: { cached?: boolean }) => {
  const report = cached
    ? {
        ...coverageReport,
        portfolio: {
          ...coverageReport.portfolio,
          equity: undefined,
        },
      }
    : coverageReport
  const analytics = useReportAnalytics({
    report,
    deals: coverageDeals,
    underlyingBySymbol: coverageUnderlying,
    drawdownMode: 'mtm',
    rollingWindow: 504,
    selectedSleeve: null,
    pdfObfuscate: false,
    pdfPageWidth: 840,
    pdfCellSize: 28,
  })
  const value = createReportContext({
    report: analytics.report ?? report,
    deals: coverageDeals,
    drawdownMode: 'mtm',
    underlyingSeries: Object.values(coverageUnderlying),
    portfolioDrawdown: analytics.portfolioDrawdown,
    portfolioDrawdownFallback: analytics.portfolioDrawdownFallback,
    portfolioDrawdownSource: analytics.portfolioDrawdownSource,
    portfolioSummary: analytics.portfolioSummary,
  })
  return <PortfolioTabHarness value={value} />
}

describe('PortfolioTab', () => {
  it.each([false, true])(
    'combines snapshots and candles with recorded-only provenance (cached: %s)',
    (cached) => {
      renderWithTheme(<DrawdownSourceHarness cached={cached} />)
      expect(screen.queryByRole('combobox', { name: 'In-trade source' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('Recorded equity only')).toHaveTextContent(
        'Recorded equity · outside candle-covered days',
      )
      expect(screen.queryByLabelText('Realized drawdown fallback')).not.toBeInTheDocument()
      expect(
        screen.getByText('Recorded account equity · D1 estimates fill missing days'),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('heading', {
          name: 'Portfolio drawdown (recorded equity + D1 estimates)',
        }),
      ).toBeInTheDocument()
    },
  )

  beforeEach(() => {
    chartRenderSpies.equity.mockClear()
    chartRenderSpies.drawdown.mockClear()
  })

  it('renders portfolio analytics and forwards view controls', async () => {
    const user = userEvent.setup()
    const onPnlScaleModeChange = vi.fn()
    const onShowCorrNumbersChange = vi.fn()
    const value = createReportContext({
      onPnlScaleModeChange,
      onShowCorrNumbersChange,
    })

    renderWithTheme(<PortfolioTabHarness value={value} />)

    expect(screen.getByText('2 out of 2 strategy sleeves selected')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset to baseline' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Portfolio balance' })).toBeInTheDocument()
    expect(screen.getByText('Portfolio monthly returns')).toBeInTheDocument()
    expect(screen.getByText('Portfolio summary')).toBeInTheDocument()
    const health = screen.getByRole('region', { name: 'Portfolio health' })
    const factors = screen.getByRole('region', { name: 'Factor diagnostics' })
    const summary = screen.getByRole('region', { name: 'Portfolio summary' })
    const equityHeading = screen.getByRole('heading', { name: 'Portfolio balance' })
    const correlationHeading = screen.getByText('Cross-strategy correlation')
    expect(
      equityHeading.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      correlationHeading.compareDocumentPosition(factors) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(factors).getByRole('button', { name: 'Explain Observations' }),
    ).toBeInTheDocument()
    expect(within(factors).getByRole('columnheader', { name: 'Observations' })).toBeInTheDocument()
    expect(within(factors).getByText('20')).toBeInTheDocument()
    expect(within(health).getByText('Healthy')).toBeInTheDocument()
    expect(within(health).getByText('Insufficient')).toBeInTheDocument()
    expect(within(health).getByText('1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log' }))
    await user.click(screen.getByRole('switch', { name: 'Show values' }))

    expect(onPnlScaleModeChange).toHaveBeenCalledWith('log')
    expect(onShowCorrNumbersChange).toHaveBeenCalledWith(false)
  })

  it('shows insufficient evidence separately from healthy and review statuses', () => {
    const base = createReportContext()
    const healthy = base.tables.riskRows[0]
    const insufficient = {
      ...healthy,
      id: 2,
      status: 'UNKNOWN' as const,
      alphaPct: null,
      alphaEvidence: { ...healthy.alphaEvidence, state: 'INSUFFICIENT' as const },
      statusReasonCodes: ['ALPHA_INSUFFICIENT' as const],
    }

    renderWithTheme(
      <PortfolioTabHarness value={createReportContext({ riskRows: [healthy, insufficient] })} />,
    )

    const health = screen.getByRole('region', { name: 'Portfolio health' })
    const insufficientCell = within(health).getByText('Insufficient').parentElement?.parentElement
    expect(insufficientCell).not.toBeNull()
    expect(within(insufficientCell as HTMLElement).getByText('1')).toBeInTheDocument()
    expect(
      within(insufficientCell as HTMLElement).getByText('50% of 2 strategy sleeves'),
    ).toBeInTheDocument()
  })

  it('supports filtering the portfolio composition', async () => {
    const user = userEvent.setup()
    renderWithTheme(<StatefulPortfolioTab />)

    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    const dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Beta - USDJPY' }))
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    expect(screen.queryByRole('dialog', { name: 'Change portfolio composition' })).toBeNull()
    await waitFor(() => {
      expect(screen.getByText('1 out of 2 strategy sleeves selected')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Results use the selected strategy sleeves and their weights/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset to baseline' }))

    await waitFor(() => {
      expect(screen.getByText('2 out of 2 strategy sleeves selected')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Reset to baseline' })).not.toBeInTheDocument()
  })

  it('keeps composition draft edits from rerendering the portfolio charts', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PortfolioTabHarness value={createReportContext()} />)

    const equityRendersBeforeOpening = chartRenderSpies.equity.mock.calls.length
    const drawdownRendersBeforeOpening = chartRenderSpies.drawdown.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    const dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    expect(chartRenderSpies.equity).toHaveBeenCalledTimes(equityRendersBeforeOpening)
    expect(chartRenderSpies.drawdown).toHaveBeenCalledTimes(drawdownRendersBeforeOpening)

    fireEvent.change(within(dialog).getAllByRole('textbox', { name: 'Weight' })[0], {
      target: { value: '1.25' },
    })

    expect(within(dialog).getAllByRole('textbox', { name: 'Weight' })[0]).toHaveValue('1.25')
    expect(chartRenderSpies.equity).toHaveBeenCalledTimes(equityRendersBeforeOpening)
    expect(chartRenderSpies.drawdown).toHaveBeenCalledTimes(drawdownRendersBeforeOpening)

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    expect(
      within(screen.getByRole('dialog', { name: 'Change portfolio composition' })).getAllByRole(
        'textbox',
        { name: 'Weight' },
      )[0],
    ).toHaveValue('1.00')
  })

  it('applies custom chart dates to the portfolio analytics sections', async () => {
    renderWithTheme(<PortfolioTabHarness value={createReportContext()} />)

    const summary = screen.getByRole('region', { name: 'Portfolio summary' })
    const tradingDaysCell = within(summary).getByText('Trading days').parentElement?.parentElement
    expect(tradingDaysCell).not.toBeNull()
    expect(within(tradingDaysCell as HTMLElement).getByText('2')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Factor diagnostics' })).getByText('20'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Portfolio equity date range start date value'), {
      target: { value: '02 Jan 2024' },
    })

    await waitFor(() => {
      expect(within(tradingDaysCell as HTMLElement).getByText('1')).toBeInTheDocument()
    })
    expect(
      within(screen.getByRole('region', { name: 'Factor diagnostics' })).getByText(
        /not enough aligned underlying data/i,
      ),
    ).toBeInTheDocument()
  })
})
