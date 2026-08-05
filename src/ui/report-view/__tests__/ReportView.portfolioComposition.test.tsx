// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReportStore } from '../../../store/report'
import { useUnderlyingStore } from '../../../store/underlying'
import { useWizardStore } from '../../../store/wizard'
import { createReport } from '../../../test/reportFixtures'
import { renderWithTheme } from '../../../test/render'
import ReportView from '../ReportView'

const calculationSpies = vi.hoisted(() => ({
  weightedPortfolio: vi.fn(),
}))

vi.mock('../../../store/idbStorage', () => ({
  idbStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}))

vi.mock('../components/PerformanceTab', () => ({
  default: () => <div>Performance content</div>,
}))

vi.mock('../components/RiskTab', () => ({
  default: () => <div>Risk content</div>,
}))

vi.mock('../components/SleevesTab', () => ({
  default: () => <div>Sleeves content</div>,
}))

vi.mock('../charts', () => ({
  EquityChart: () => <div data-testid="equity-chart" />,
  DrawdownChart: () => <div data-testid="drawdown-chart" />,
}))

vi.mock('../portfolio/portfolioCalculations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../portfolio/portfolioCalculations')>()
  return {
    ...actual,
    buildWeightedPortfolio: (...args: Parameters<typeof actual.buildWeightedPortfolio>) => {
      calculationSpies.weightedPortfolio()
      return actual.buildWeightedPortfolio(...args)
    },
  }
})

describe('ReportView portfolio composition', () => {
  beforeEach(() => {
    calculationSpies.weightedPortfolio.mockClear()
    const report = createReport()
    useReportStore.setState({
      report,
      baseReport: report,
      deals: null,
      baseDeals: null,
      marDegradationPct: null,
      hasHydrated: true,
    })
    useUnderlyingStore.setState({ seriesBySymbol: {}, hasHydrated: true })
    useWizardStore.getState().resetWizard()
  })

  it('reuses applied custom analytics when returning to the portfolio tab', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReportView />)

    await user.click(screen.getByRole('tab', { name: 'Portfolio' }))
    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    let dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Beta - USDJPY' }))
    const alphaWeight = within(dialog).getAllByRole('textbox', { name: 'Weight' })[0]
    fireEvent.change(alphaWeight, { target: { value: '1.25' } })
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    })
    expect(calculationSpies.weightedPortfolio).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('tab', { name: 'Performance' }))
    await user.click(screen.getByRole('tab', { name: 'Portfolio' }))

    expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    expect(calculationSpies.weightedPortfolio).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    expect(within(dialog).getByRole('checkbox', { name: 'Beta - USDJPY' })).not.toBeChecked()
    expect(within(dialog).getAllByRole('textbox', { name: 'Weight' })[0]).toHaveValue('1.25')
  })

  it('keeps an explicit baseline reset across tab navigation', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReportView />)

    await user.click(screen.getByRole('tab', { name: 'Portfolio' }))
    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    let dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Beta - USDJPY' }))
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(within(dialog).getByRole('button', { name: 'Reset to baseline' }))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('2 out of 2 sleeves selected')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Risk / Decay' }))
    await user.click(screen.getByRole('tab', { name: 'Portfolio' }))

    expect(screen.getByText('2 out of 2 sleeves selected')).toBeInTheDocument()
    expect(screen.queryByText('custom weights (1)')).not.toBeInTheDocument()
    expect(calculationSpies.weightedPortfolio).toHaveBeenCalledTimes(1)
  })
})
