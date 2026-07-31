export const CORRELATION_LEGEND_MIN_WIDTH = 280
export const CORRELATION_LEGEND_WIDTH = 340
export const CORRELATION_LAYOUT_GAP = 24

export const calculateCorrelationCellSize = ({
  baseCellSize,
  portfolioSize,
  containerWidth,
  sideBySide,
}: {
  baseCellSize: number
  portfolioSize: number
  containerWidth: number
  sideBySide: boolean
}) => {
  const maximumCellSize = Math.round(baseCellSize * Math.SQRT2)
  if (portfolioSize <= 0 || containerWidth <= 0) return baseCellSize

  const availableWidth = Math.max(
    0,
    containerWidth - (sideBySide ? CORRELATION_LEGEND_WIDTH + CORRELATION_LAYOUT_GAP : 0),
  )
  const fittingCellSize = Math.floor(availableWidth / (portfolioSize + 1))
  return Math.max(baseCellSize, Math.min(maximumCellSize, fittingCellSize))
}
