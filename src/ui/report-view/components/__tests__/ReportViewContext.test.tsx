// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { useReportNavigation, useReportPortfolio } from '../ReportViewContext'
import ReportViewProvider from '../ReportViewProvider'

describe('ReportViewContext', () => {
  it('provides focused report contracts to descendants', () => {
    const value = createReportContext({ tab: 'risk' })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ReportViewProvider value={value}>{children}</ReportViewProvider>
    )

    const { result } = renderHook(
      () => ({
        navigation: useReportNavigation(),
        portfolio: useReportPortfolio(),
      }),
      { wrapper },
    )

    expect(result.current.navigation).toBe(value.navigation)
    expect(result.current.navigation.tab).toBe('risk')
    expect(result.current.portfolio).toBe(value.portfolio)
  })

  it('fails clearly when consumed without a provider', () => {
    expect(() => renderHook(() => useReportNavigation())).toThrow(
      'useReportNavigation must be used within ReportViewProvider',
    )
  })
})
