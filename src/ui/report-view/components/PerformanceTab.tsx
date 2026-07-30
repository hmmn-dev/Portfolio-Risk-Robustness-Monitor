import { DataGrid } from '@mui/x-data-grid'
import dataGridSx from './dataGridSx'
import { useReportTables } from './ReportViewContext'

const PerformanceTab = () => {
  const { performanceRows, gridPerformanceColumns } = useReportTables()
  return (
    <DataGrid
      autoHeight
      rows={performanceRows}
      columns={gridPerformanceColumns}
      getRowHeight={() => 'auto'}
      disableRowSelectionOnClick
      sx={dataGridSx}
    />
  )
}

export default PerformanceTab
