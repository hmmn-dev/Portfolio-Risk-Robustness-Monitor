import { Box, Typography } from '@mui/material'

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
          border: '1px solid #d6d6d6',
          padding: '6px 8px',
        },
        '& th': {
          textAlign: 'left',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          backgroundColor: '#f2f4f7',
          color: '#344054',
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
                    color: cell.negative ? '#b42318' : 'inherit',
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
