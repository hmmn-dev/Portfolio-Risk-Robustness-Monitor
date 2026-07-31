import { Box, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { correlationColor, isLightColor } from '../../colors'
import type { CorrelationMatrix } from '../../types'

type PortfolioCorrelationPanelProps = {
  matrix: CorrelationMatrix
  legend: string
  cellSize: number
  showNumbers: boolean
  theme: Theme
  onShowNumbersChange: (value: boolean) => void
}

const PortfolioCorrelationPanel = ({
  matrix,
  legend,
  cellSize,
  showNumbers,
  theme,
  onShowNumbersChange,
}: PortfolioCorrelationPanelProps) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Cross-sleeve correlation
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showNumbers}
            onChange={(event) => onShowNumbersChange(event.target.checked)}
          />
        }
        label="Show values"
      />
    </Stack>
    <Box
      sx={{
        mt: 2,
        display: { xs: 'block', lg: 'grid' },
        gridTemplateColumns: { lg: 'auto minmax(280px, 1fr)' },
        gap: 3,
        alignItems: 'start',
      }}
    >
      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `${cellSize}px repeat(${matrix.labels.length}, ${cellSize}px)`,
            gridAutoRows: `${cellSize}px`,
            alignItems: 'center',
          }}
        >
          <Box />
          {matrix.labels.map((label, index) => (
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
          {matrix.labels.map((label, rowIndex) => (
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
                const isLarge = matrix.labels.length > 12
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
                      fontSize: showNumbers ? (isLarge ? 10 : 12) : 0,
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
          gridTemplateRows: `repeat(${matrix.labels.length + 1}, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`,
          alignItems: 'center',
          minWidth: 280,
        }}
      >
        <Box />
        {matrix.labels.map((label, index) => (
          <Typography
            key={label}
            variant="body2"
            sx={{ color: theme.palette.text.primary, fontWeight: 600, pl: 1 }}
          >
            {index + 1}. {label}
          </Typography>
        ))}
      </Box>
    </Box>
  </Paper>
)

export default PortfolioCorrelationPanel
