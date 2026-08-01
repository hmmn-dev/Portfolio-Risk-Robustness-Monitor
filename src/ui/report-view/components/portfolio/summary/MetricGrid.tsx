import { Box } from '@mui/material'
import type { ReactNode } from 'react'

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type MetricGridProps = {
  children: ReactNode
  columns: Partial<Record<Breakpoint, string>>
}

const MetricGrid = ({ children, columns }: MetricGridProps) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: columns,
      gap: '1px',
      backgroundColor: 'divider',
      borderTop: 1,
      borderColor: 'divider',
    }}
  >
    {children}
  </Box>
)

export default MetricGrid
