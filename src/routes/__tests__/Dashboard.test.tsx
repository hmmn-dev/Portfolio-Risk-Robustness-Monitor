// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import Dashboard from '../Dashboard'

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({
    rows,
    columns,
  }: {
    rows: Array<Record<string, unknown>>
    columns: Array<{ field: string; headerName?: string }>
  }) => (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.field}>{column.headerName}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            {columns.map((column) => (
              <td key={column.field}>{String(row[column.field])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

describe('Dashboard', () => {
  it('renders overview metrics and strategic account data', () => {
    renderWithTheme(<Dashboard />)

    expect(screen.getByRole('heading', { name: 'Liquidity Overview' })).toBeInTheDocument()
    expect(screen.getByText('Net Inflow')).toBeInTheDocument()
    expect(screen.getByText('€48.2M')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('Northwind Capital')).toBeInTheDocument()
    expect(screen.getByText('Sterling Grove')).toBeInTheDocument()
  })
})
