// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import type { RiskRow } from '../../types'
import { StatusCell, StatusHeader } from '../ReportGridCells'

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
