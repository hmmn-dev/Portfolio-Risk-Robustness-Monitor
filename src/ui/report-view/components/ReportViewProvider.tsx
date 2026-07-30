import type { ReactNode } from 'react'
import {
  ReportNavigationContext,
  ReportPdfContext,
  ReportPortfolioContext,
  ReportSleevesContext,
  ReportTablesContext,
  type ReportViewContextValues,
} from './ReportViewContext'

type ReportViewProviderProps = {
  value: ReportViewContextValues
  children: ReactNode
}

const ReportViewProvider = ({ value, children }: ReportViewProviderProps) => (
  <ReportNavigationContext.Provider value={value.navigation}>
    <ReportTablesContext.Provider value={value.tables}>
      <ReportSleevesContext.Provider value={value.sleeves}>
        <ReportPortfolioContext.Provider value={value.portfolio}>
          <ReportPdfContext.Provider value={value.pdf}>{children}</ReportPdfContext.Provider>
        </ReportPortfolioContext.Provider>
      </ReportSleevesContext.Provider>
    </ReportTablesContext.Provider>
  </ReportNavigationContext.Provider>
)

export default ReportViewProvider
