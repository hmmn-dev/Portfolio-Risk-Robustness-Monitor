// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { useReportViewContext } from '../ReportViewContext'
import ReportViewProvider from '../ReportViewProvider'

describe('ReportViewContext', () => {
  it('provides the report view contract to descendants', () => {
    const value = createReportContext({ tab: 'risk' })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ReportViewProvider value={value}>{children}</ReportViewProvider>
    )

    const { result } = renderHook(() => useReportViewContext(), { wrapper })

    expect(result.current).toBe(value)
    expect(result.current.tab).toBe('risk')
  })

  it('fails clearly when consumed without a provider', () => {
    expect(() => renderHook(() => useReportViewContext())).toThrow(
      'useReportViewContext must be used within ReportViewProvider',
    )
  })
})
