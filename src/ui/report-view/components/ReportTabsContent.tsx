import PerformanceTab from './PerformanceTab'
import PortfolioTab from './PortfolioTab'
import RiskTab from './RiskTab'
import SleevesTab from './SleevesTab'
import { useReportViewContext } from './ReportViewContext'

const ReportTabsContent = () => {
  const { tab } = useReportViewContext()
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
    return <PortfolioTab />
  }

  return null
}

export default ReportTabsContent
