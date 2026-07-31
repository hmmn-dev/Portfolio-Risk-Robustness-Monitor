import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import type { DrawdownMode } from '../../reportAnalytics'

type PortfolioToolbarProps = {
  enabledCount: number
  totalSleeves: number
  modifiedWeightCount: number
  hasMtmDrawdown: boolean
  drawdownMode: DrawdownMode
  pnlScaleMode: 'linear' | 'log'
  onOpenComposition: () => void
  onDrawdownModeChange: (mode: DrawdownMode) => void
  onPnlScaleModeChange: (mode: 'linear' | 'log') => void
}

const PortfolioToolbar = ({
  enabledCount,
  totalSleeves,
  modifiedWeightCount,
  hasMtmDrawdown,
  drawdownMode,
  pnlScaleMode,
  onOpenComposition,
  onDrawdownModeChange,
  onPnlScaleModeChange,
}: PortfolioToolbarProps) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    spacing={1.5}
    alignItems={{ sm: 'center' }}
    justifyContent="space-between"
  >
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="outlined" size="small" onClick={onOpenComposition}>
        Change portfolio composition
      </Button>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" color="text.secondary">
          {enabledCount} out of {totalSleeves} sleeves selected
        </Typography>
        {modifiedWeightCount > 0 && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={`custom weights (${modifiedWeightCount})`}
          />
        )}
      </Stack>
    </Stack>
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
      flexWrap="wrap"
    >
      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
        Portfolio drawdown
      </Typography>
      <ToggleButtonGroup
        size="small"
        value={drawdownMode}
        exclusive
        onChange={(_event, value) => {
          if (value) onDrawdownModeChange(value)
        }}
      >
        <ToggleButton value="deal">Realized</ToggleButton>
        {!hasMtmDrawdown ? (
          <Tooltip
            title="In-Trade drawdown requires matched deal prices and uploaded underlying candles."
            placement="top"
            disableInteractive
          >
            <Box component="span" sx={{ display: 'inline-flex' }} tabIndex={0}>
              <ToggleButton value="mtm" disabled>
                In-Trade
              </ToggleButton>
            </Box>
          </Tooltip>
        ) : (
          <ToggleButton value="mtm">In-Trade</ToggleButton>
        )}
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
        PnL scale
      </Typography>
      <ToggleButtonGroup
        size="small"
        value={pnlScaleMode}
        exclusive
        onChange={(_event, value) => {
          if (value) onPnlScaleModeChange(value)
        }}
      >
        <ToggleButton value="linear">Linear</ToggleButton>
        <ToggleButton value="log">Log</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  </Stack>
)

export default PortfolioToolbar
