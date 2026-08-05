// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../../store/ui'
import { renderWithTheme } from '../../test/render'
import AppShell from '../AppShell'

describe('AppShell', () => {
  beforeEach(() => {
    useUIStore.setState({ colorMode: 'light' })
  })

  it('renders branding and page content', () => {
    renderWithTheme(
      <AppShell>
        <div>Page content</div>
      </AppShell>,
    )

    expect(screen.getByAltText('Portfolio Monitoring logo')).toHaveAttribute('src', '/logo.png')
    expect(screen.getByText('Portfolio Monitoring Tool')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Page content')
  })

  it('toggles the persisted color mode from the header control', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <AppShell>
        <div />
      </AppShell>,
    )

    await user.click(screen.getByRole('button', { name: 'Toggle color mode' }))

    expect(useUIStore.getState().colorMode).toBe('dark')
  })
})
