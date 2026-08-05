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

describe('PortfolioTab', () => {
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

    expect(screen.getByText('2 out of 2 sleeves selected')).toBeInTheDocument()
    expect(screen.getByText('Portfolio equity')).toBeInTheDocument()
    expect(screen.getByText('Portfolio monthly returns')).toBeInTheDocument()
    expect(screen.getByText('Portfolio summary')).toBeInTheDocument()
    const health = screen.getByRole('region', { name: 'Portfolio health' })
    const factors = screen.getByRole('region', { name: 'Factor diagnostics' })
    const summary = screen.getByRole('region', { name: 'Portfolio summary' })
    const equityHeading = screen.getByText('Portfolio equity')
    const correlationHeading = screen.getByText('Cross-sleeve correlation')
    expect(
      equityHeading.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      correlationHeading.compareDocumentPosition(factors) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(factors).getByText('Observations')).toBeInTheDocument()
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
      within(insufficientCell as HTMLElement).getByText('50% of 2 sleeves'),
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
      expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Results use the selected sleeve series and weights/),
    ).toBeInTheDocument()
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
