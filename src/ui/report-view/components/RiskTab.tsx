import { DataGrid } from '@mui/x-data-grid'
import dataGridSx from './dataGridSx'
import { useReportTables } from './ReportViewContext'

const RiskTab = () => {
  const { riskRows, gridRiskColumns } = useReportTables()
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
