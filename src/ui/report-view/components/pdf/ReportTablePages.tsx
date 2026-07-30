import type { PerformanceRow, RiskRow } from '../../types'
import PdfPage from '../PdfPage'
import PdfTable, { type PdfColumn } from '../PdfTable'

type ReportTablePagesProps = {
  pdfName: string
  width: number
  minHeight: number
  performanceColumns: PdfColumn<PerformanceRow>[]
  performanceRows: PerformanceRow[]
  riskColumns: PdfColumn<RiskRow>[]
  riskRows: RiskRow[]
}

const ReportTablePages = ({
  pdfName,
  width,
  minHeight,
  performanceColumns,
  performanceRows,
  riskColumns,
  riskRows,
}: ReportTablePagesProps) => (
  <>
    <PdfPage title="Performance table" pdfName={pdfName} width={width} minHeight={minHeight}>
      <PdfTable title="Performance" columns={performanceColumns} rows={performanceRows} />
    </PdfPage>
    <PdfPage title="Risk / decay table" pdfName={pdfName} width={width} minHeight={minHeight}>
      <PdfTable title="Risk / decay" columns={riskColumns} rows={riskRows} />
    </PdfPage>
  </>
)

export default ReportTablePages
