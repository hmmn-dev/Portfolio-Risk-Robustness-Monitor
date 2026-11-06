// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import { createAppTheme } from '../../../../theme'
import {
  createPerformanceColumns,
  createRiskColumns,
  PDF_PERFORMANCE_COLUMNS,
  PDF_RISK_COLUMNS,
} from '../../reportColumns'
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
    const value = createReportContext({
      gridPerformanceColumns: createPerformanceColumns(createAppTheme('light')),
    })
    renderWithTheme(
      <ReportViewProvider value={value}>
        <PerformanceTab />
      </ReportViewProvider>,
    )

    expect(screen.getByTestId('data-grid')).toHaveTextContent('Strategy|Symbol')
    expect(screen.getByTestId('data-grid')).toHaveTextContent('Alpha:')
  })

  it('passes risk rows and columns to the grid', () => {
    const value = createReportContext({
      gridRiskColumns: createRiskColumns(createAppTheme('light')),
    })
    renderWithTheme(
      <ReportViewProvider value={value}>
        <RiskTab />
      </ReportViewProvider>,
    )

    expect(screen.getByTestId('data-grid')).toHaveTextContent('Strategy|Symbol|Status')
    expect(screen.getByTestId('data-grid')).toHaveTextContent('Alpha:GREEN')
  })

  it('marks buckets explicitly in both PDF tables', () => {
    const context = createReportContext()
    const performanceRow = { ...context.tables.performanceRows[0], symbol: 'EQ', isBucket: true }
    const riskRow = { ...context.tables.riskRows[0], symbol: 'EQ', isBucket: true }
    expect(PDF_PERFORMANCE_COLUMNS[1].getCell(performanceRow).text).toBe('EQ (bucket)')
    expect(PDF_RISK_COLUMNS[1].getCell(riskRow).text).toBe('EQ (bucket)')
    expect(PDF_PERFORMANCE_COLUMNS[1].getCell({ ...performanceRow, isBucket: false }).text).toBe(
      'EQ',
    )
  })

  it('uses the same strategy terminology in PDF tables', () => {
    expect(PDF_PERFORMANCE_COLUMNS[0].header).toBe('Strategy')
    expect(PDF_RISK_COLUMNS[0].header).toBe('Strategy')
  })
})
