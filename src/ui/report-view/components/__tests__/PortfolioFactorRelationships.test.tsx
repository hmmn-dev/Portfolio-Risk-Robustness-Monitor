// @vitest-environment jsdom

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithTheme } from '../../../../test/render'
import type { FactorRelationships } from '../../portfolio/factorRelationships'
import PortfolioRegressionSummary from '../portfolio/summary/PortfolioRegressionSummary'

const relationships: FactorRelationships = {
  portfolio: {
    daily: [{ symbol: 'EURUSD', beta: 0.1, correlation: 0.9, observations: 80 }],
    monthly: [{ symbol: 'EURUSD', beta: 0.15, correlation: 0.75, observations: 12 }],
  },
  symbols: {
    daily: [{ symbol: 'EURUSD', beta: 0.03, correlation: 0.6, observations: 60 }],
    monthly: [{ symbol: 'EURUSD', beta: null, correlation: null, observations: 2 }],
  },
}

describe('portfolio factor relationships', () => {
  it('shows standard beta and correlation across scopes and frequencies without a normalization switch', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PortfolioRegressionSummary regression={null} relationships={relationships} />)
    const panel = screen.getByRole('region', { name: 'Beta and correlation' })
    const table = within(panel).getByRole('table', { name: 'Factor betas and correlations' })
    expect(within(panel).getByRole('button', { name: 'Whole portfolio' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(panel).queryByRole('switch')).not.toBeInTheDocument()
    expect(
      within(table).queryByRole('columnheader', { name: 'Normalized beta' }),
    ).not.toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Beta' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: 'EURUSD 0.10 0.90 80' })).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Monthly' }))
    expect(within(table).getByRole('row', { name: 'EURUSD 0.15 0.75 12' })).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Per symbol' }))
    expect(within(table).getByRole('row', { name: 'EURUSD n/a n/a 2' })).toBeInTheDocument()
    expect(within(panel).getByText(/Uses realized return contributions/)).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Daily' }))
    expect(within(table).getByRole('row', { name: 'EURUSD 0.03 0.60 60' })).toBeInTheDocument()
  })

  it('shows the supplied exposure-sensitive beta separately from correlation', () => {
    const { rerender } = renderWithTheme(
      <PortfolioRegressionSummary regression={null} relationships={relationships} />,
    )
    expect(screen.getByRole('row', { name: 'EURUSD 0.10 0.90 80' })).toBeInTheDocument()
    rerender(
      <PortfolioRegressionSummary
        regression={null}
        relationships={{
          ...relationships,
          portfolio: {
            ...relationships.portfolio,
            daily: [{ symbol: 'EURUSD', beta: 0.01, correlation: 0.9, observations: 80 }],
          },
        }}
      />,
    )
    expect(screen.getByRole('row', { name: 'EURUSD 0.01 0.90 80' })).toBeInTheDocument()
  })

  it('supports keyboard help and preserves symbol obfuscation', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <PortfolioRegressionSummary
        regression={null}
        relationships={relationships}
        formatSymbol={() => 'Asset-01'}
      />,
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'Explain beta and correlation' })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Pairwise beta follows QuantConnect',
    )
    expect(screen.getByRole('rowheader', { name: 'Asset-01' })).toBeInTheDocument()
    expect(screen.queryByText('EURUSD')).not.toBeInTheDocument()
  })

  it('keeps unavailable underlying data explicit', () => {
    const empty: FactorRelationships = {
      portfolio: { daily: [], monthly: [] },
      symbols: { daily: [], monthly: [] },
    }
    renderWithTheme(<PortfolioRegressionSummary regression={null} relationships={empty} />)
    expect(screen.getByText(/No matching symbol data/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
