import type { Theme } from '@mui/material/styles'
import type { MonthlyReturnRow } from '../../portfolio/portfolioCalculations'
import PdfPage from '../PdfPage'
import MonthlyReturnsTable from '../portfolio/MonthlyReturnsTable'

const PortfolioMonthlyReturnsPage = ({
  pdfName,
  width,
  minHeight,
  rows,
  theme,
}: {
  pdfName: string
  width: number
  minHeight: number
  rows: MonthlyReturnRow[]
  theme: Theme
}) => (
  <PdfPage title="Portfolio monthly returns" pdfName={pdfName} width={width} minHeight={minHeight}>
    <MonthlyReturnsTable rows={rows} theme={theme} />
  </PdfPage>
)

export default PortfolioMonthlyReturnsPage
