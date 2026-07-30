import type { DailyPoint, ReportModel } from '../../../../engine/types'
import PdfPage from '../PdfPage'
import PortfolioChartsPanel from '../portfolio/PortfolioChartsPanel'

type PortfolioChartsPageProps = {
  pdfName: string
  width: number
  minHeight: number
  index: DailyPoint[]
  drawdown: DailyPoint[]
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  pnlScaleMode: 'linear' | 'log'
  baseCapital: number
  pnlColor: string
  axisColor: string
  gridColor: string
}

const PortfolioChartsPage = ({
  pdfName,
  width,
  minHeight,
  index,
  drawdown,
  drawdownSource,
  pnlScaleMode,
  baseCapital,
  pnlColor,
  axisColor,
  gridColor,
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
      drawdownSource={drawdownSource}
      pnlScaleMode={pnlScaleMode}
      baseCapital={baseCapital}
      pnlColor={pnlColor}
      axisColor={axisColor}
      gridColor={gridColor}
      equityHeight={280}
      drawdownHeight={200}
    />
  </PdfPage>
)

export default PortfolioChartsPage
