import { Box, Typography } from '@mui/material'
import { REPORT_PRINT_COLORS } from '../printTheme'

export type PdfCell = { text: string; negative?: boolean; align?: 'left' | 'right' | 'center' }
export type PdfColumn<Row> = { header: string; getCell: (row: Row) => PdfCell }

const PdfTable = <Row,>({
  title,
  columns,
  rows,
}: {
  title: string
  columns: PdfColumn<Row>[]
  rows: Row[]
}) => (
  <Box>
    <Typography variant="h6" sx={{ mb: 1 }}>
      {title}
    </Typography>
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 11,
        '& th, & td': {
          border: `1px solid ${REPORT_PRINT_COLORS.tableBorder}`,
          padding: '6px 8px',
        },
        '& th': {
          textAlign: 'left',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0,
          backgroundColor: REPORT_PRINT_COLORS.tableHeaderBackground,
          color: REPORT_PRINT_COLORS.tableHeaderText,
        },
      }}
    >
      <Box component="thead">
        <Box component="tr">
          {columns.map((column) => (
            <Box key={column.header} component="th">
              {column.header}
            </Box>
          ))}
        </Box>
      </Box>
      <Box component="tbody">
        {rows.map((row, index) => (
          <Box key={index} component="tr">
            {columns.map((column) => {
              const cell = column.getCell(row)
              return (
                <Box
                  key={column.header}
                  component="td"
                  sx={{
                    textAlign: cell.align ?? 'left',
                    color: cell.negative ? REPORT_PRINT_COLORS.negative : 'inherit',
                  }}
                >
                  {cell.text}
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
)

export default PdfTable
