// @vitest-environment jsdom

import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../../test/render'
import LazySection from '../LazySection'

const defaultObserver = globalThis.IntersectionObserver

afterEach(() => {
  vi.stubGlobal('IntersectionObserver', defaultObserver)
})

describe('LazySection', () => {
  it('renders children immediately when lazy rendering is disabled', () => {
    renderWithTheme(
      <LazySection placeholderHeight={300} disabled>
        <div>Visible content</div>
      </LazySection>,
    )

    expect(screen.getByText('Visible content')).toBeInTheDocument()
  })

  it('replaces its placeholder after entering the viewport', () => {
    let onIntersect: IntersectionObserverCallback | undefined
    const disconnect = vi.fn()

    class ControlledObserver {
      constructor(callback: IntersectionObserverCallback) {
        onIntersect = callback
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect
      takeRecords() {
        return []
      }
    }

    vi.stubGlobal('IntersectionObserver', ControlledObserver)
    renderWithTheme(
      <LazySection placeholderHeight={300}>
        <div>Deferred content</div>
      </LazySection>,
    )

    expect(screen.queryByText('Deferred content')).not.toBeInTheDocument()

    act(() => {
      onIntersect?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    expect(screen.getByText('Deferred content')).toBeInTheDocument()
    expect(disconnect).toHaveBeenCalled()
  })
})
