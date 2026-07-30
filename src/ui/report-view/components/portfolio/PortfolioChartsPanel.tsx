import { Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { computeDdShock } from '../../../../engine/ddShock'
import type { DailyPoint, ReportModel } from '../../../../engine/types'
import { DrawdownChart, EquityChart } from '../../charts'
import { formatDrawdownSourceLabel } from '../../formatters'

type PortfolioChartsPanelProps = {
  index: DailyPoint[]
  drawdown: DailyPoint[]
  drawdownSource?: ReportModel['portfolio']['drawdownSource']
  pnlScaleMode: 'linear' | 'log'
  baseCapital: number
  pnlColor: string
  axisColor: string
  gridColor: string
  equityHeight?: number
  drawdownHeight?: number
}

const PortfolioChartsPanel = ({
  index,
  drawdown,
  drawdownSource,
  pnlScaleMode,
  baseCapital,
  pnlColor,
  axisColor,
  gridColor,
  equityHeight = 360,
  drawdownHeight = 200,
}: PortfolioChartsPanelProps) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2">Portfolio equity</Typography>
        <EquityChart
          data={index}
          scaleMode="percent"
          pnlScaleMode={pnlScaleMode}
          baseValue={baseCapital}
          drawdownSeries={drawdown}
          height={equityHeight}
          minOffsetRatio={0}
          reserveGridlines={0}
          color={pnlColor}
          axisColor={axisColor}
          gridColor={gridColor}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2">
          Portfolio drawdown ({formatDrawdownSourceLabel(drawdownSource)})
        </Typography>
        <DrawdownChart
          data={drawdown}
          height={drawdownHeight}
          axisColor={axisColor}
          gridColor={gridColor}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2">Drawdown shock</Typography>
        <Chip label={computeDdShock(drawdown).flag} />
      </Box>
    </Stack>
  </Paper>
)

export default PortfolioChartsPanel
