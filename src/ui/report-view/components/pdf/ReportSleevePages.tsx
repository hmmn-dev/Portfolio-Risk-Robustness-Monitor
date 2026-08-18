import type { ReportModel } from '../../../../engine/types'
import type { SleeveMetrics } from '../SleeveSection'
import PdfPage from '../PdfPage'
import SleeveSectionPrint from '../SleeveSectionPrint'

type ReportSleevePagesProps = {
  report: ReportModel
  pdfName: string
  width: number
  minHeight: number
  baseCapital: number
  pnlScaleMode: 'linear' | 'log'
  buildMetrics: (item: ReportModel['contributions'][number]) => SleeveMetrics | null
  getDrawdown: (
    item: ReportModel['contributions'][number],
  ) => ReportModel['contributions'][number]['drawdown']
  getDrawdownSource: (
    item: ReportModel['contributions'][number],
  ) => ReportModel['contributions'][number]['drawdownSource']
  formatLabel: (label: string) => string
}

const ReportSleevePages = ({
  report,
  pdfName,
  width,
  minHeight,
  baseCapital,
  pnlScaleMode,
  buildMetrics,
  getDrawdown,
  getDrawdownSource,
  formatLabel,
}: ReportSleevePagesProps) => (
  <>
    {report.contributions.map((item) => {
      const metrics = buildMetrics(item)
      if (!metrics) return null
      return (
        <PdfPage
          key={item.sleeve}
          title={`Strategy: ${formatLabel(item.sleeve)}`}
          pdfName={pdfName}
          width={width}
          minHeight={minHeight}
        >
          <SleeveSectionPrint
            item={item}
            metrics={metrics}
            baseCapital={baseCapital}
            drawdownSeries={getDrawdown(item)}
            drawdownSource={getDrawdownSource(item)}
            pnlScaleMode={pnlScaleMode}
          />
        </PdfPage>
      )
    })}
  </>
)

export default ReportSleevePages
