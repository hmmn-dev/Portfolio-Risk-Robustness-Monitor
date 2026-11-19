import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  Box,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import type { RelationshipFrequency } from '../../../../../engine/benchmarkRelationships'
import { formatSigned } from '../../../formatters'
import type { FactorRelationships } from '../../../portfolio/factorRelationships'

type Props = {
  relationships: FactorRelationships
  formatSymbol?: (symbol: string) => string
}

const PortfolioFactorRelationships = ({
  relationships,
  formatSymbol = (symbol) => symbol,
}: Props) => {
  const [scope, setScope] = useState<'portfolio' | 'symbols'>('portfolio')
  const [frequency, setFrequency] = useState<RelationshipFrequency>('daily')
  const rows = relationships[scope][frequency]
  return (
    <Box
      component="section"
      aria-label="Beta and correlation"
      sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography component="h3" variant="subtitle2">
          Factor betas &amp; correlation
        </Typography>
        <Tooltip
          arrow
          title="Pairwise beta follows QuantConnect: covariance of strategy and market returns divided by market-return variance. Correlation is Pearson correlation. Smaller exposure lowers standard beta, but not correlation. At least 3 matched observations are required; missing prices are never treated as zero returns."
        >
          <IconButton
            size="small"
            aria-label="Explain beta and correlation"
            sx={{ p: 0.25, color: 'text.secondary' }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        flexWrap="wrap"
        useFlexGap
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scope}
          aria-label="Return series"
          onChange={(_, value: 'portfolio' | 'symbols' | null) => {
            if (value) setScope(value)
          }}
        >
          <ToggleButton value="portfolio">Whole portfolio</ToggleButton>
          <ToggleButton value="symbols">Per symbol</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={frequency}
          aria-label="Return frequency"
          onChange={(_, value: RelationshipFrequency | null) => {
            if (value) setFrequency(value)
          }}
        >
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="monthly">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        {scope === 'portfolio'
          ? 'Displayed portfolio returns versus each underlying market.'
          : 'Selected strategies trading each symbol versus that symbol’s market. Uses realized return contributions; account-wide equity cannot be split by symbol.'}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, mb: 1.5 }}>
        Standard beta reflects exposure size. Correlation measures the relationship independently of
        positive return scaling.
        {frequency === 'monthly'
          ? ' Monthly returns are compounded; months with incomplete matching dates are excluded. Boundary months follow the selected date range.'
          : ''}
      </Typography>
      {rows.length ? (
        <TableContainer
          tabIndex={0}
          role="region"
          aria-label="Factor relationship results"
          sx={{ maxHeight: 440, overflow: 'auto' }}
        >
          <Table
            size="small"
            stickyHeader
            aria-label="Factor betas and correlations"
            sx={{ minWidth: 360 }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell align="right">Beta</TableCell>
                <TableCell align="right">Correlation</TableCell>
                <TableCell align="right">Observations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.symbol}
                  sx={{ '&:last-child td, &:last-child th': { borderBottom: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {formatSymbol(row.symbol)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSigned(row.beta ?? NaN, 2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSigned(row.correlation ?? NaN, 2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {row.observations}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No matching symbol data. Import underlying prices for the selected strategies.
        </Typography>
      )}
    </Box>
  )
}

export default PortfolioFactorRelationships
