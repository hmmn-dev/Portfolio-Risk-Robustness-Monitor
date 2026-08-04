import type { DailyPoint, ReportModel } from '../../../../engine/types'
import PdfPage from '../PdfPage'
import PortfolioChartsPanel from '../portfolio/PortfolioChartsPanel'

type PortfolioChartsPageProps = {
  pdfName: string
  width: number
  minHeight: number
  index: DailyPoint[]
  drawdown: DailyPoint[]
  drawdownFallback: DailyPoint[]
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  pnlScaleMode: 'linear' | 'log'
  baseCapital: number
}

const PortfolioChartsPage = ({
  pdfName,
  width,
  minHeight,
  index,
  drawdown,
  drawdownFallback,
  drawdownSource,
  pnlScaleMode,
  baseCapital,
}: PortfolioChartsPageProps) => (
  <PdfPage
    title="Portfolio equity & drawdown"
    pdfName={pdfName}
    width={width}
    minHeight={minHeight}
  >
    <PortfolioChartsPanel
      index={index}
      drawdown={drawdown}
      drawdownFallback={drawdownFallback}
      drawdownSource={drawdownSource}
      pnlScaleMode={pnlScaleMode}
      baseCapital={baseCapital}
      equityHeight={280}
      drawdownHeight={200}
      showRangeSelector={false}
    />
  </PdfPage>
)

export default PortfolioChartsPage
