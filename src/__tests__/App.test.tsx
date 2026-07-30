// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useReportStore } from '../store/report'
import { createReport } from '../test/reportFixtures'
import { renderWithTheme } from '../test/render'

vi.mock('../store/idbStorage', () => ({
  idbStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}))

vi.mock('../ui/AppShell', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../ui/Wizard', () => ({
  default: () => <div>Wizard screen</div>,
}))

vi.mock('../ui/report-view/ReportView', () => ({
  default: () => <div>Report screen</div>,
}))

describe('App routing', () => {
  beforeEach(() => {
    useReportStore.setState({
      report: null,
      baseReport: null,
      deals: null,
      baseDeals: null,
      marDegradationPct: null,
      hasHydrated: true,
    })
    window.history.pushState({}, '', '/')
  })

  it('waits for persisted report state before redirecting', () => {
    useReportStore.setState({ hasHydrated: false })

    renderWithTheme(<App />)

    expect(screen.getByTestId('app-shell')).toBeEmptyDOMElement()
    expect(screen.queryByText('Wizard screen')).not.toBeInTheDocument()
  })

  it('redirects an empty home session to the wizard', async () => {
    renderWithTheme(<App />)

    expect(await screen.findByText('Wizard screen')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/wizard')
  })

  it('guards the report route when no report exists', async () => {
    window.history.pushState({}, '', '/report')

    renderWithTheme(<App />)

    expect(await screen.findByText('Wizard screen')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/wizard')
  })

  it('redirects the wizard to an existing report', async () => {
    useReportStore.setState({ report: createReport() })
    window.history.pushState({}, '', '/wizard')

    renderWithTheme(<App />)

    expect(await screen.findByText('Report screen')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/report')
  })
})
