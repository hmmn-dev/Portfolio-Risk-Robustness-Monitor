// @vitest-environment jsdom

import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithTheme } from '../../../../test/render'
import PdfPage from '../PdfPage'
import PdfTable from '../PdfTable'

describe('PDF primitives', () => {
  it('renders page metadata, content, and the PDF page marker', () => {
    const { container } = renderWithTheme(
      <PdfPage title="Risk report" pdfName="" width={840} minHeight={1123}>
        <div>Page body</div>
      </PdfPage>,
    )

    expect(screen.getByText('Portfolio Monitoring Tool')).toBeInTheDocument()
    expect(screen.getByText('Risk report')).toBeInTheDocument()
    expect(screen.getByText('Page body')).toBeInTheDocument()
    expect(container.querySelector('[data-pdf-page]')).toBeInTheDocument()
  })

  it('renders typed columns and cells as a semantic table', () => {
    renderWithTheme(
      <PdfTable
        title="Performance"
        columns={[
          { header: 'Sleeve', getCell: (row: { sleeve: string }) => ({ text: row.sleeve }) },
          {
            header: 'PnL',
            getCell: (row: { pnl: number }) => ({
              text: String(row.pnl),
              negative: row.pnl < 0,
              align: 'right',
            }),
          },
        ]}
        rows={[
          { sleeve: 'Alpha', pnl: 12 },
          { sleeve: 'Beta', pnl: -4 },
        ]}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2)
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('Alpha')).toBeInTheDocument()
    expect(within(table).getByText('-4')).toBeInTheDocument()
  })
})
