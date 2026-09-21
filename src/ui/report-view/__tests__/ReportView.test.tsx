// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import type { DealRow } from '../../../engine/types'
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

vi.mock('../components/ReportTabsContent', async () => {
  const { useReportPdf, useReportPortfolio, useReportSleeves, useReportTables } =
    await import('../components/ReportViewContext')
  const MockReportTabsContent = () => {
    const portfolio = useReportPortfolio()
    const sleeves = useReportSleeves()
    const tables = useReportTables()
    const pdf = useReportPdf()
    return (
      <div>
        Active report content
        <span data-testid="correlation-values-default">{String(portfolio.showCorrNumbers)}</span>
        <span data-testid="table-sleeves">
          {tables.performanceRows.map((row) => `${row.sleeve}:${row.symbol}`).join('|')}
        </span>
        <span data-testid="strategy-count">{sleeves.report.contributions.length}</span>
        <span data-testid="portfolio-count">{portfolio.report.contributions.length}</span>
        <span data-testid="pdf-count">{pdf.report.contributions.length}</span>
      </div>
    )
  }
  return {
    default: MockReportTabsContent,
  }
})

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
    expect(screen.getByTestId('correlation-values-default')).toHaveTextContent('true')
    expect(screen.getByRole('tab', { name: 'Performance' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Strategies' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Risk / Decay' }))

    expect(screen.getByRole('tab', { name: 'Risk / Decay' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('enables one global bucket view by default and can reveal member sleeves', async () => {
    const user = userEvent.setup()
    const deals: DealRow[] = [
      {
        deal: 'SPY-1',
        time: Date.UTC(2026, 0, 1),
        sleeve: 'Daily Capitulation MR [EQ] - SPY',
        symbol: 'SPY',
        notional: 100,
        _seq: 0,
      },
      {
        deal: 'QQQ-1',
        time: Date.UTC(2026, 0, 2),
        sleeve: 'Daily Capitulation MR [EQ] - QQQ',
        symbol: 'QQQ',
        notional: 50,
        _seq: 1,
      },
    ]
    const report = buildPortfolioReport(deals, {
      initialCapital: 1000,
      generatedAt: Date.UTC(2026, 0, 3),
      dealsSourceName: 'bucketed.csv',
    })
    useReportStore.setState({ report, baseReport: report, deals, baseDeals: deals })

    renderWithTheme(<ReportView />)

    const bucketSwitch = screen.getByRole('switch', { name: 'Bucket view' })
    expect(bucketSwitch).toBeChecked()
    expect(screen.getByTestId('table-sleeves')).toHaveTextContent('Daily Capitulation MR - EQ:')
    expect(screen.getByTestId('strategy-count')).toHaveTextContent('1')
    expect(screen.getByTestId('portfolio-count')).toHaveTextContent('1')
    expect(screen.getByTestId('pdf-count')).toHaveTextContent('1')

    await user.click(bucketSwitch)

    expect(bucketSwitch).not.toBeChecked()
    expect(screen.getByTestId('table-sleeves')).toHaveTextContent(
      'Daily Capitulation MR [EQ]:QQQ|Daily Capitulation MR [EQ]:SPY',
    )
    expect(screen.getByTestId('strategy-count')).toHaveTextContent('2')
    expect(screen.getByTestId('portfolio-count')).toHaveTextContent('2')
    expect(screen.getByTestId('pdf-count')).toHaveTextContent('2')
  })

  it('opens and cancels PDF generation settings', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReportView />)

    await user.click(screen.getByRole('button', { name: 'Generate PDF report' }))

    expect(screen.getByRole('dialog', { name: 'Generate PDF report' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Portfolio name' })).toHaveValue(
      'Portfolio Monitoring Tool',
    )
    expect(
      screen.getByRole('switch', { name: 'Obfuscate strategy and symbol names' }),
    ).toBeChecked()

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
