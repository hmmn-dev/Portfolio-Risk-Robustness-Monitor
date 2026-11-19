import type { ReportModel } from './types'

// Balance-based contribution denominators stay canonical for exposure weighting.
// The account equity path is used only for baseline portfolio performance.
export const resolvePortfolioPerformance = (report: ReportModel, useEquity: boolean) => {
  const equity = useEquity ? report.portfolio.equity : undefined
  return {
    chartIndex: equity?.index ?? report.portfolio.index,
    index: equity?.dailyIndex ?? report.portfolio.index,
    returns:
      equity?.dailyReturns ??
      report.portfolio.days.map((day) => ({ time: day.time, value: day.return })),
    source: equity?.source,
  }
}
