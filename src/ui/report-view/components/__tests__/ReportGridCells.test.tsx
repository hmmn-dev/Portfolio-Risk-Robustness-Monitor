// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import type { RiskRow } from '../../types'
import { StatusCell, StatusHeader, SymbolCell } from '../ReportGridCells'

const UnknownStatusCell = ({ row }: { row: RiskRow }) => {
  const theme = useTheme()
  return <StatusCell row={row} theme={theme} />
}

const ThemedStatusHeader = () => {
  const theme = useTheme()
  return <StatusHeader theme={theme} />
}

const createUnknownRow = (): RiskRow => {
  const row = createReportContext().tables.riskRows[0]
  return {
    ...row,
    status: 'UNKNOWN',
    alphaPct: null,
    alphaEvidence: {
      ...row.alphaEvidence,
      state: 'INSUFFICIENT',
      activeObservations: 24,
      lastValidTime: Date.UTC(2025, 10, 15),
    },
    statusReasonCodes: ['ALPHA_INSUFFICIENT'],
    statusReasons: 'Reason: alpha unavailable: 24/30 active observations.',
    statusAction: 'Collect more observations; do not infer health or decay yet.',
  }
}

describe('risk status cells', () => {
  it('renders insufficient evidence as a neutral named state with keyboard details', async () => {
    const user = userEvent.setup()
    renderWithTheme(<UnknownStatusCell row={createUnknownRow()} />)

    const status = screen.getByLabelText(/INSUFFICIENT\. Reason: alpha unavailable/i)
    expect(screen.getByText('INSUFFICIENT')).toBeInTheDocument()

    await user.tab()
    expect(status).toHaveFocus()
    expect(await screen.findByText(/24\/30 active · underlying/i)).toBeInTheDocument()
    expect(screen.getByText(/do not infer health or decay yet/i)).toBeInTheDocument()
  })

  it('exposes the complete status legend through a named keyboard control', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ThemedStatusHeader />)

    const help = screen.getByRole('button', { name: 'Explain status logic' })
    await user.hover(help)

    expect(await screen.findByText('Status Legend')).toBeInTheDocument()
    expect(screen.getByText('INSUFFICIENT')).toBeInTheDocument()
    expect(screen.getByText(/neither healthy nor a decay warning/i)).toBeInTheDocument()
  })
})

describe('symbol cells', () => {
  it.each(['EQ', 'Rates - Global'])(
    'explains the %s bucket on hover and keyboard focus',
    async (symbol) => {
      const user = userEvent.setup()
      renderWithTheme(<SymbolCell symbol={symbol} isBucket isDark={false} hasFocus />)
      const bucket = screen.getByRole('button', { name: `${symbol} bucket` })
      expect(bucket).toHaveTextContent(symbol)
      expect(bucket).toHaveTextContent('B')
      await user.hover(bucket)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        "Bucket: combines this strategy's symbol sleeves.",
      )
      await user.unhover(bucket)
      await user.tab()
      expect(bucket).toHaveFocus()
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Bucket:')
    },
  )

  it.each(['SPY', ''])(
    'keeps ordinary symbols and missing symbols free of bucket markers: %s',
    (symbol) => {
      renderWithTheme(<SymbolCell symbol={symbol} isDark={false} hasFocus={false} />)
      expect(screen.getByText(symbol || '-')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByText('B')).not.toBeInTheDocument()
    },
  )
})
