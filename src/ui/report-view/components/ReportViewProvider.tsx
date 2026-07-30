import type { ReactNode } from 'react'
import { ReportViewContext, type ReportViewContextValue } from './ReportViewContext'

type ReportViewProviderProps = {
  value: ReportViewContextValue
  children: ReactNode
}

const ReportViewProvider = ({ value, children }: ReportViewProviderProps) => (
  <ReportViewContext.Provider value={value}>{children}</ReportViewContext.Provider>
)

export default ReportViewProvider
