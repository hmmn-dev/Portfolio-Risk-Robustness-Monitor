import { Box, Paper, Stack, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { correlationColor, isLightColor } from '../../colors'
import type { CorrelationMatrix } from '../../types'
import PdfPage from '../PdfPage'

type PortfolioCorrelationPageProps = {
  pdfName: string
  width: number
  minHeight: number
  labels: string[]
  matrix: CorrelationMatrix
  cellSize: number
  legend: string
  showNumbers: boolean
  theme: Theme
}

const PortfolioCorrelationPage = ({
  pdfName,
  width,
  minHeight,
  labels,
  matrix,
  cellSize,
  legend,
  showNumbers,
  theme,
}: PortfolioCorrelationPageProps) => (
  <PdfPage title="Portfolio correlation" pdfName={pdfName} width={width} minHeight={minHeight}>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2">Cross-strategy correlation</Typography>
      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `${cellSize}px repeat(${labels.length}, ${cellSize}px)`,
              gridAutoRows: `${cellSize}px`,
              alignItems: 'center',
            }}
          >
            <Box />
            {labels.map((label, index) => (
              <Typography
                key={label}
                variant="caption"
                sx={{
                  fontWeight: 600,
                  textAlign: 'center',
                  color: theme.palette.text.secondary,
                  fontSize: 11,
                }}
              >
                {index + 1}
              </Typography>
            ))}
            {labels.map((label, rowIndex) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    textAlign: 'center',
                    color: theme.palette.text.secondary,
                    fontSize: 11,
                  }}
                >
                  {rowIndex + 1}
                </Typography>
                {matrix.values[rowIndex]?.map((value, columnIndex) => {
                  const backgroundColor = correlationColor(value)
                  const isLarge = labels.length > 12
                  return (
                    <Box
                      key={`${label}-${columnIndex}`}
                      sx={{
                        width: cellSize,
                        height: cellSize,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor,
                        color: isLightColor(backgroundColor)
                          ? theme.palette.common.black
                          : theme.palette.common.white,
                        fontSize: showNumbers ? (isLarge ? 9 : 11) : 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {showNumbers ? (value == null ? '-' : value.toFixed(2)) : ''}
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="caption">-1.0</Typography>
            <Box sx={{ width: 220, height: 10, background: legend, borderRadius: 999 }} />
            <Typography variant="caption">1.0</Typography>
          </Stack>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 0.5,
            width: '100%',
          }}
        >
          {labels.map((label, index) => (
            <Typography
              key={label}
              variant="body2"
              sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
            >
              {index + 1}. {label}
            </Typography>
          ))}
        </Box>
      </Box>
    </Paper>
  </PdfPage>
)

export default PortfolioCorrelationPage
