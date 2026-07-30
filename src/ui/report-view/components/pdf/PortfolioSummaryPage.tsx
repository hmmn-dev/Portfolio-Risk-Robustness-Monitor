import type { DailyPoint, ReportModel } from '../../../../engine/types'
import type { DrawdownMode } from '../../reportAnalytics'
import type { PortfolioSummary, RiskRow } from '../../types'
import PdfPage from '../PdfPage'
import PortfolioSummaryPanel from '../portfolio/PortfolioSummaryPanel'

type PortfolioSummaryPageProps = {
  pdfName: string
  width: number
  minHeight: number
  summary: PortfolioSummary | null
  drawdown: DailyPoint[]
  drawdownMode: DrawdownMode
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  riskRows: RiskRow[]
  formatSymbol: (symbol: string) => string
}

const PortfolioSummaryPage = ({
  pdfName,
  width,
  minHeight,
  summary,
  drawdown,
  drawdownMode,
  drawdownSource,
  riskRows,
  formatSymbol,
}: PortfolioSummaryPageProps) => (
  <PdfPage title="Portfolio summary" pdfName={pdfName} width={width} minHeight={minHeight}>
    <PortfolioSummaryPanel
      summary={summary}
      drawdown={drawdown}
      drawdownMode={drawdownMode}
      drawdownSource={drawdownSource}
      riskRows={riskRows}
      customPortfolio={false}
      formatSymbol={formatSymbol}
    />
  </PdfPage>
)

export default PortfolioSummaryPage
