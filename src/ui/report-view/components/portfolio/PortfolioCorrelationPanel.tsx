import { Box, FormControlLabel, Paper, Stack, Switch, Tooltip, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'
import { correlationColor, isLightColor } from '../../colors'
import type { CorrelationMatrix } from '../../types'

const CorrelationLegendLabel = ({ index, label }: { index: number; label: string }) => {
  const textRef = useRef<HTMLDivElement | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const text = `${index + 1}. ${label}`

  useEffect(() => {
    const element = textRef.current
    if (!element) return
    const update = () => setIsTruncated(element.scrollWidth > element.clientWidth)
    update()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [text])

  return (
    <Tooltip
      title={isTruncated ? text : ''}
      arrow
      placement="top"
      disableHoverListener={!isTruncated}
    >
      <Typography
        ref={textRef}
        component="div"
        variant="body2"
        noWrap
        sx={{ minWidth: 0, width: '100%', color: 'text.primary', fontWeight: 600, px: 1 }}
      >
        {text}
      </Typography>
    </Tooltip>
  )
}

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
        gridTemplateColumns: { lg: 'minmax(0, 1fr) minmax(280px, 320px)' },
        gap: 3,
        alignItems: 'start',
      }}
    >
      <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
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
          minWidth: 0,
          width: '100%',
        }}
      >
        <Box />
        {matrix.labels.map((label, index) => (
          <CorrelationLegendLabel key={label} index={index} label={label} />
        ))}
      </Box>
    </Box>
  </Paper>
)

export default PortfolioCorrelationPanel
