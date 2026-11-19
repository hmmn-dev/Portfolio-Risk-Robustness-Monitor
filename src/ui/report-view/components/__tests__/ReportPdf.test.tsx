// @vitest-environment jsdom

import { buildPortfolioReport } from '../../../../engine/portfolioSeries'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import { PDF_RISK_COLUMNS } from '../../reportColumns'
import ReportPdf from '../ReportPdf'
import ReportViewProvider from '../ReportViewProvider'

vi.mock('../../charts', () => ({
  EquityChart: ({ data }: { data: { value: number }[] }) => (
    <div data-testid="pdf-equity-chart">{data.at(-1)?.value}</div>
  ),
  DrawdownChart: ({ realizedFallback = [] }: { realizedFallback?: unknown[] }) => (
    <div data-testid="pdf-drawdown-chart" data-fallback-count={realizedFallback.length} />
  ),
}))

vi.mock('../SleeveSectionPrint', () => ({
  default: ({ item }: { item: { sleeve: string } }) => (
    <div data-testid="print-sleeve">{item.sleeve}</div>
  ),
}))

describe('ReportPdf', () => {
  it('exports candle-source fallback provenance', () => {
    const points = [0, -1, -2, -3].map((value, index) => ({
      time: Date.UTC(2024, 0, index + 1),
      value,
    }))
    const value = createReportContext({
      drawdownMode: 'mtm',
      portfolioDrawdown: points,
      portfolioDrawdownFallback: [points[0], points[3]],
      portfolioDrawdownSource: 'H1',
    })
    renderWithTheme(
      <ReportViewProvider value={value}>
        <ReportPdf />
      </ReportViewProvider>,
    )
    expect(screen.getByLabelText('Realized drawdown fallback')).toHaveTextContent(
      'Realized DD where candles are unavailable',
    )
    expect(screen.getByTestId('pdf-drawdown-chart')).toHaveAttribute('data-fallback-count', '2')
  })

  it('exports recorded equity instead of the balance index', () => {
    const report = buildPortfolioReport(
      [
        {
          deal: '1',
          time: Date.UTC(2024, 0, 1),
          sleeve: 'Core',
          notional: 0,
          balance: 1000,
          equity: 1000,
          _seq: 0,
        },
        {
          deal: '2',
          time: Date.UTC(2024, 0, 2),
          sleeve: 'Core',
          notional: 200,
          balance: 1200,
          equity: 1020,
          _seq: 1,
        },
      ],
      { initialCapital: 1000 },
    )
    const value = createReportContext({ report, drawdownMode: 'mtm' })
    renderWithTheme(
      <ReportViewProvider value={value}>
        <ReportPdf />
      </ReportViewProvider>,
    )
    expect(screen.getByText('Portfolio equity & drawdown')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-equity-chart')).toHaveTextContent('1.02')
    expect(screen.getByText(/Recorded account equity/)).toBeInTheDocument()
  })

  it('builds all report pages, including one page per sleeve', () => {
    const value = createReportContext()
    const { container } = renderWithTheme(
      <ReportViewProvider value={value}>
        <ReportPdf />
      </ReportViewProvider>,
    )

    expect(container.querySelectorAll('[data-pdf-page]')).toHaveLength(8)
    expect(screen.getByText('Performance table')).toBeInTheDocument()
    expect(screen.getByText('Risk / decay table')).toBeInTheDocument()
    expect(screen.getByText('Portfolio balance & drawdown')).toBeInTheDocument()
    expect(screen.getByText('Portfolio correlation')).toBeInTheDocument()
    expect(screen.getByText('Cross-strategy correlation')).toBeInTheDocument()
    expect(screen.getByText('Strategy: PDF Alpha - EURUSD')).toBeInTheDocument()
    expect(screen.getAllByTestId('print-sleeve')).toHaveLength(2)
    expect(screen.getAllByText('Test Portfolio')).toHaveLength(8)
    expect(screen.queryByRole('group', { name: /equity date range/i })).not.toBeInTheDocument()
  })

  it('prints insufficient alpha evidence without presenting it as a warning', () => {
    const base = createReportContext()
    const row = base.tables.riskRows[0]
    const insufficient = {
      ...row,
      status: 'UNKNOWN' as const,
      alphaPct: null,
      alphaEvidence: {
        ...row.alphaEvidence,
        state: 'INSUFFICIENT' as const,
        activeObservations: 24,
      },
      statusReasonCodes: ['ALPHA_INSUFFICIENT' as const],
    }
    const value = createReportContext({
      pdfRiskRows: [insufficient],
      pdfRiskColumns: PDF_RISK_COLUMNS,
    })

    renderWithTheme(
      <ReportViewProvider value={value}>
        <ReportPdf />
      </ReportViewProvider>,
    )

    expect(screen.getByText('INSUFFICIENT')).toBeInTheDocument()
    expect(screen.getByText('24/30 active · underlying')).toBeInTheDocument()
  })
})
