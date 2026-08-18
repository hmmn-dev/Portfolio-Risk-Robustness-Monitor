import {
  Box,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { correlationColor, isLightColor } from '../../colors'
import {
  calculateCorrelationCellSize,
  CORRELATION_LEGEND_MIN_WIDTH,
  CORRELATION_LEGEND_WIDTH,
} from '../../helpers/correlationLayout'
import type { CorrelationMatrix } from '../../types'

const useContainerWidth = () => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(Math.round(element.getBoundingClientRect().width))
    update()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return { ref, width }
}

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
}: PortfolioCorrelationPanelProps) => {
  const { ref: layoutRef, width: containerWidth } = useContainerWidth()
  const sideBySide = useMediaQuery(theme.breakpoints.up('lg'))
  const responsiveCellSize = calculateCorrelationCellSize({
    baseCellSize: cellSize,
    portfolioSize: matrix.labels.length,
    containerWidth,
    sideBySide,
  })
  const matrixWidth = (matrix.labels.length + 1) * responsiveCellSize
  const valueFontSize = responsiveCellSize >= 36 ? 12 : responsiveCellSize >= 31 ? 11 : 10

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Typography component="h2" variant="subtitle1">
          Cross-strategy correlation
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
        ref={layoutRef}
        sx={{
          mt: 2,
          display: { xs: 'block', lg: 'flex' },
          gap: 3,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          minWidth: 0,
        }}
      >
        <Box
          data-testid="correlation-matrix-scroll"
          sx={{
            minWidth: 0,
            overflowX: 'auto',
            flex: { lg: '0 1 auto' },
            width: { lg: matrixWidth },
            maxWidth: '100%',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              width: 'max-content',
              gridTemplateColumns: `${responsiveCellSize}px repeat(${matrix.labels.length}, ${responsiveCellSize}px)`,
              gridAutoRows: `${responsiveCellSize}px`,
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
                  return (
                    <Box
                      key={`${label}-${columnIndex}`}
                      data-testid="correlation-cell"
                      sx={{
                        width: responsiveCellSize,
                        height: responsiveCellSize,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor,
                        color: isLightColor(backgroundColor)
                          ? theme.palette.common.black
                          : theme.palette.common.white,
                        fontSize: showNumbers ? valueFontSize : 0,
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
          data-testid="correlation-strategy-legend"
          sx={{
            display: 'grid',
            gridTemplateRows: `repeat(${matrix.labels.length + (sideBySide ? 1 : 0)}, ${responsiveCellSize}px)`,
            gridAutoRows: `${responsiveCellSize}px`,
            alignItems: 'center',
            flex: { lg: `0 0 ${CORRELATION_LEGEND_WIDTH}px` },
            minWidth: { lg: CORRELATION_LEGEND_MIN_WIDTH },
            width: { xs: '100%', lg: CORRELATION_LEGEND_WIDTH },
            maxWidth: '100%',
            mt: { xs: 2, lg: 0 },
          }}
        >
          {sideBySide && <Box />}
          {matrix.labels.map((label, index) => (
            <CorrelationLegendLabel key={label} index={index} label={label} />
          ))}
        </Box>
      </Box>
    </Paper>
  )
}

export default memo(PortfolioCorrelationPanel)
