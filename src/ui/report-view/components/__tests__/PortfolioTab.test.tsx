// @vitest-environment jsdom

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import PortfolioTab from '../PortfolioTab'
import ReportViewProvider from '../ReportViewProvider'

vi.mock('../../charts', () => ({
  EquityChart: () => <div data-testid="equity-chart" />,
  DrawdownChart: () => <div data-testid="drawdown-chart" />,
}))

describe('PortfolioTab', () => {
  it('renders portfolio analytics and forwards view controls', async () => {
    const user = userEvent.setup()
    const onPnlScaleModeChange = vi.fn()
    const onShowCorrNumbersChange = vi.fn()
    const value = createReportContext({
      onPnlScaleModeChange,
      onShowCorrNumbersChange,
    })

    renderWithTheme(
      <ReportViewProvider value={value}>
        <PortfolioTab />
      </ReportViewProvider>,
    )

    expect(screen.getByText('2 out of 2 sleeves selected')).toBeInTheDocument()
    expect(screen.getByText('Portfolio equity')).toBeInTheDocument()
    expect(screen.getByText('Portfolio monthly returns')).toBeInTheDocument()
    expect(screen.getByText('Portfolio summary')).toBeInTheDocument()
    expect(screen.getByText('Portfolio regression (n=20)')).toBeInTheDocument()
    expect(screen.getByText(/GREEN=1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log' }))
    await user.click(screen.getByRole('switch', { name: 'Show values' }))

    expect(onPnlScaleModeChange).toHaveBeenCalledWith('log')
    expect(onShowCorrNumbersChange).toHaveBeenCalledWith(false)
  })

  it('supports filtering the portfolio composition', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <ReportViewProvider value={createReportContext()}>
        <PortfolioTab />
      </ReportViewProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    const dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Beta - USDJPY' }))
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    expect(
      screen.getByText(/Results are based on the selected sleeve series and weights/),
    ).toBeInTheDocument()
  })
})
