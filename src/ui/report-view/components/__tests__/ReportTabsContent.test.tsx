// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import ReportTabsContent from '../ReportTabsContent'
import ReportViewProvider from '../ReportViewProvider'

vi.mock('../PerformanceTab', () => ({ default: () => <div>Performance content</div> }))
vi.mock('../RiskTab', () => ({ default: () => <div>Risk content</div> }))
vi.mock('../SleevesTab', () => ({ default: () => <div>Sleeves content</div> }))
vi.mock('../PortfolioTab', () => ({ default: () => <div>Portfolio content</div> }))

describe('ReportTabsContent', () => {
  it.each([
    ['performance', 'Performance content'],
    ['risk', 'Risk content'],
    ['sleeves', 'Sleeves content'],
    ['portfolio', 'Portfolio content'],
  ] as const)('renders the %s tab', (tab, expected) => {
    renderWithTheme(
      <ReportViewProvider value={createReportContext({ tab })}>
        <ReportTabsContent />
      </ReportViewProvider>,
    )

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
