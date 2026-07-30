// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import { ReportViewProvider } from '../ReportViewContext'
import SleevesTab from '../SleevesTab'

vi.mock('../SleeveSection', () => ({
  default: ({ item }: { item: { sleeve: string } }) => (
    <div data-testid="sleeve-section">{item.sleeve}</div>
  ),
}))

vi.mock('../../LazySection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('SleevesTab', () => {
  it('selects sleeves and forwards display control changes', async () => {
    const user = userEvent.setup()
    const onSelectSleeve = vi.fn()
    const onPnlScaleModeChange = vi.fn()
    const onRollingWindowChange = vi.fn()
    const value = createReportContext({
      onSelectSleeve,
      onPnlScaleModeChange,
      onRollingWindowChange,
    })

    renderWithTheme(
      <ReportViewProvider value={value}>
        <SleevesTab />
      </ReportViewProvider>,
    )

    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByTestId('sleeve-section')).toHaveTextContent('Alpha - EURUSD')
    expect(screen.getByRole('button', { name: 'In-Trade DD' })).toBeDisabled()

    await user.click(screen.getByRole('tab', { name: 'Beta - USDJPY' }))
    await user.click(screen.getByRole('button', { name: 'Log' }))
    await user.click(screen.getByRole('button', { name: '1Y' }))

    expect(onSelectSleeve).toHaveBeenCalledWith('Beta - USDJPY')
    expect(onPnlScaleModeChange).toHaveBeenCalledWith('log')
    expect(onRollingWindowChange).toHaveBeenCalledWith(252)
  })

  it('renders every contribution in all-sleeves mode', () => {
    const value = createReportContext({ sleeveViewMode: 'all' })

    renderWithTheme(
      <ReportViewProvider value={value}>
        <SleevesTab />
      </ReportViewProvider>,
    )

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All sleeves' })).toBeInTheDocument()
    expect(screen.getAllByTestId('sleeve-section')).toHaveLength(2)
  })
})
