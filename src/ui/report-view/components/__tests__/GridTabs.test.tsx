// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import PerformanceTab from '../PerformanceTab'
import ReportViewProvider from '../ReportViewProvider'
import RiskTab from '../RiskTab'

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({
    rows,
    columns,
  }: {
    rows: Array<Record<string, unknown>>
    columns: Array<{ field: string; headerName?: string }>
  }) => (
    <div data-testid="data-grid">
      <div>{columns.map((column) => column.headerName).join('|')}</div>
      <div>{rows.map((row) => `${String(row.sleeve)}:${String(row.status ?? '')}`).join('|')}</div>
    </div>
  ),
}))

describe('report grid tabs', () => {
  it('passes performance rows and columns to the grid', () => {
    renderWithTheme(
      <ReportViewProvider value={createReportContext()}>
        <PerformanceTab />
      </ReportViewProvider>,
    )

    expect(screen.getByTestId('data-grid')).toHaveTextContent('Sleeve|Symbol')
    expect(screen.getByTestId('data-grid')).toHaveTextContent('Alpha:')
  })

  it('passes risk rows and columns to the grid', () => {
    renderWithTheme(
      <ReportViewProvider value={createReportContext()}>
        <RiskTab />
      </ReportViewProvider>,
    )

    expect(screen.getByTestId('data-grid')).toHaveTextContent('Sleeve|Status')
    expect(screen.getByTestId('data-grid')).toHaveTextContent('Alpha:GREEN')
  })
})
