import PerformanceTab from './PerformanceTab'
import PortfolioTab from './PortfolioTab'
import RiskTab from './RiskTab'
import SleevesTab from './SleevesTab'
import { usePortfolioViewModel } from '../hooks/usePortfolioViewModel'
import { useReportNavigation, useReportPortfolio } from './ReportViewContext'

const ReportTabsContent = () => {
  const { tab } = useReportNavigation()
  const portfolio = useReportPortfolio()
  const portfolioViewModel = usePortfolioViewModel(portfolio)
  if (tab === 'performance') {
    return <PerformanceTab />
  }

  if (tab === 'risk') {
    return <RiskTab />
  }

  if (tab === 'sleeves') {
    return <SleevesTab />
  }

  if (tab === 'portfolio') {
    return <PortfolioTab viewModel={portfolioViewModel} />
  }

  return null
}

export default ReportTabsContent
