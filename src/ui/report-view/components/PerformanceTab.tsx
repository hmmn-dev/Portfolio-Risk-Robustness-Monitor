import { DataGrid } from '@mui/x-data-grid'
import dataGridSx from './dataGridSx'
import { useReportViewContext } from './ReportViewContext'

const PerformanceTab = () => {
  const { performanceRows, gridPerformanceColumns } = useReportViewContext()
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
