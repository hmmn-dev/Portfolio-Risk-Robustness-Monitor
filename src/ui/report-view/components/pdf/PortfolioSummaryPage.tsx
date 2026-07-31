import { Stack } from '@mui/material'
import type { DailyPoint, ReportModel } from '../../../../engine/types'
import type { DrawdownMode } from '../../reportAnalytics'
import type { PortfolioSummary, RiskRow } from '../../types'
import PdfPage from '../PdfPage'
import PortfolioSummaryPanel from '../portfolio/PortfolioSummaryPanel'
import PortfolioRegressionSummary from '../portfolio/summary/PortfolioRegressionSummary'

type PortfolioSummaryPageProps = {
  pdfName: string
  width: number
  minHeight: number
  summary: PortfolioSummary | null
  index: DailyPoint[]
  returns: DailyPoint[]
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
  index,
  returns,
  drawdown,
  drawdownMode,
  drawdownSource,
  riskRows,
  formatSymbol,
}: PortfolioSummaryPageProps) => (
  <PdfPage title="Portfolio summary" pdfName={pdfName} width={width} minHeight={minHeight}>
    <Stack spacing={2}>
      <PortfolioSummaryPanel
        summary={summary}
        index={index}
        returns={returns}
        drawdown={drawdown}
        drawdownMode={drawdownMode}
        drawdownSource={drawdownSource}
        riskRows={riskRows}
        customPortfolio={false}
      />
      <PortfolioRegressionSummary
        regression={summary?.regression ?? null}
        formatSymbol={formatSymbol}
      />
    </Stack>
  </PdfPage>
)

export default PortfolioSummaryPage
