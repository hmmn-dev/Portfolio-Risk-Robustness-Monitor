// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import { PDF_RISK_COLUMNS } from '../../reportColumns'
import ReportPdf from '../ReportPdf'
import ReportViewProvider from '../ReportViewProvider'

vi.mock('../../charts', () => ({
  EquityChart: () => <div data-testid="pdf-equity-chart" />,
  DrawdownChart: () => <div data-testid="pdf-drawdown-chart" />,
}))

vi.mock('../SleeveSectionPrint', () => ({
  default: ({ item }: { item: { sleeve: string } }) => (
    <div data-testid="print-sleeve">{item.sleeve}</div>
  ),
}))

describe('ReportPdf', () => {
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
    expect(screen.getByText('Portfolio equity & drawdown')).toBeInTheDocument()
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
