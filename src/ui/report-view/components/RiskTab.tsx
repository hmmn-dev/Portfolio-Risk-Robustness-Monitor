import { DataGrid } from '@mui/x-data-grid'
import dataGridSx from './dataGridSx'
import { useReportViewContext } from './ReportViewContext'

const RiskTab = () => {
  const { riskRows, gridRiskColumns } = useReportViewContext()
  return (
    <DataGrid
      autoHeight
      rows={riskRows}
      columns={gridRiskColumns}
      getRowHeight={() => 'auto'}
      disableRowSelectionOnClick
      sx={dataGridSx}
    />
  )
}

export default RiskTab
