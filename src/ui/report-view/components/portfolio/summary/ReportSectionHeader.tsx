import { Box, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

type ReportSectionHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  headingComponent?: 'h2' | 'h3'
}

const ReportSectionHeader = ({
  title,
  subtitle,
  actions,
  headingComponent = 'h2',
}: ReportSectionHeaderProps) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    spacing={1.5}
    alignItems={{ sm: 'center' }}
    justifyContent="space-between"
    sx={{ px: 2.5, py: 2 }}
  >
    <Box>
      <Typography component={headingComponent} variant="subtitle1">
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Box>
    {actions}
  </Stack>
)

export default ReportSectionHeader
