// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithTheme } from '../../test/render'
import ProgressBackdrop from '../ProgressBackdrop'

describe('ProgressBackdrop', () => {
  it('announces the operation and renders an optional visible message', () => {
    renderWithTheme(
      <ProgressBackdrop
        open
        label="Generating report"
        message="Preparing analytics"
        zIndexOffset={2}
      />,
    )

    expect(screen.getByRole('status', { name: 'Generating report' })).toBeVisible()
    expect(screen.getByText('Preparing analytics')).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Generating report progress' })).toBeVisible()
  })
})
