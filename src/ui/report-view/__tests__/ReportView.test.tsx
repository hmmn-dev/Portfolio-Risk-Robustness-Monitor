// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReportStore } from '../../../store/report'
import { useUnderlyingStore } from '../../../store/underlying'
import { useWizardStore } from '../../../store/wizard'
import { createReport } from '../../../test/reportFixtures'
import { renderWithTheme } from '../../../test/render'
import ReportView from '../ReportView'

vi.mock('../../../store/idbStorage', () => ({
  idbStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}))

vi.mock('../components/ReportTabsContent', () => ({
  default: () => <div>Active report content</div>,
}))

vi.mock('../components/ReportPdf', () => ({
  default: () => <div>Printable report</div>,
}))

describe('ReportView', () => {
  beforeEach(() => {
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

  it('renders report metadata and switches analytics tabs', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReportView />)

    expect(screen.getByRole('heading', { name: 'Report Analytics' })).toBeInTheDocument()
    expect(screen.getByText(/Deals: deals.csv/)).toBeInTheDocument()
    expect(screen.getByText('Active report content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Performance' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.click(screen.getByRole('tab', { name: 'Risk / Decay' }))

    expect(screen.getByRole('tab', { name: 'Risk / Decay' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('opens and cancels PDF generation settings', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReportView />)

    await user.click(screen.getByRole('button', { name: 'Generate PDF report' }))

    expect(screen.getByRole('dialog', { name: 'Generate PDF report' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Portfolio name' })).toHaveValue(
      'Portfolio Monitoring Report',
    )
    expect(screen.getByRole('switch', { name: 'Obfuscate sleeve and symbol names' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Generate PDF report' })).not.toBeInTheDocument()
    })
  })

  it('resets report inputs without violating React hook ordering', async () => {
    const user = userEvent.setup()
    useWizardStore.setState({ activeStep: 2 })
    useUnderlyingStore.setState({
      seriesBySymbol: {
        EURUSD: {
          symbol: 'EURUSD',
          timeframe: 'D1',
          candles: [],
          daily: [],
        },
      },
    })
    renderWithTheme(<ReportView />)

    await user.click(screen.getByRole('button', { name: 'Regenerate report' }))

    expect(screen.queryByRole('heading', { name: 'Report Analytics' })).not.toBeInTheDocument()
    expect(useReportStore.getState().report).toBeNull()
    expect(useUnderlyingStore.getState().seriesBySymbol).toEqual({})
    expect(useWizardStore.getState().activeStep).toBe(0)
  })
})
