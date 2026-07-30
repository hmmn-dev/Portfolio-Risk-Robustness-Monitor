import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined'
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import type { SyntheticEvent } from 'react'
import { useState } from 'react'
import type { ReportTab } from '../types'

type ReportHeaderProps = {
  tab: ReportTab
  reportMeta: string
  marDegradationPct: number | null
  isPdfGenerating: boolean
  isMarApplying: boolean
  canApplyMarDegradation: boolean
  onTabChange: (tab: ReportTab) => void
  onOpenPdf: () => void
  onRegenerate: () => void
  onOpenMarDegradation: () => void
  onRemoveMarDegradation: () => void
}

const reportTabs = [
  {
    label: 'Performance',
    value: 'performance',
    icon: <TableChartOutlinedIcon fontSize="small" />,
  },
  {
    label: 'Risk / Decay',
    value: 'risk',
    icon: <AssessmentOutlinedIcon fontSize="small" />,
  },
  {
    label: 'Sleeves',
    value: 'sleeves',
    icon: <ShowChartOutlinedIcon fontSize="small" />,
  },
  {
    label: 'Portfolio',
    value: 'portfolio',
    icon: <PieChartOutlineOutlinedIcon fontSize="small" />,
  },
] satisfies Array<{ label: string; value: ReportTab; icon: React.ReactNode }>

const ReportHeader = ({
  tab,
  reportMeta,
  marDegradationPct,
  isPdfGenerating,
  isMarApplying,
  canApplyMarDegradation,
  onTabChange,
  onOpenPdf,
  onRegenerate,
  onOpenMarDegradation,
  onRemoveMarDegradation,
}: ReportHeaderProps) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const handleTabChange = (_event: SyntheticEvent, value: ReportTab) => onTabChange(value)
  const handleOpenMarDegradation = () => {
    setMenuAnchor(null)
    onOpenMarDegradation()
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Typography variant="h5">Report Analytics</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {reportMeta}
        </Typography>
        {marDegradationPct != null && marDegradationPct > 0 && (
          <Chip
            size="medium"
            label={`MAR Degradation -${marDegradationPct}%`}
            sx={{ ml: { md: 1 } }}
            variant="outlined"
            onDelete={onRemoveMarDegradation}
            deleteIcon={<CancelOutlinedIcon aria-label="Remove MAR degradation" />}
          />
        )}
        <Button
          variant="outlined"
          onClick={onOpenPdf}
          disabled={isPdfGenerating}
          startIcon={<PictureAsPdfOutlinedIcon />}
        >
          Generate PDF report
        </Button>
        <Button variant="outlined" onClick={onRegenerate} startIcon={<ReplayOutlinedIcon />}>
          Regenerate report
        </Button>
        <IconButton
          aria-label="Report actions"
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          size="small"
        >
          <MoreVertOutlinedIcon />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={handleOpenMarDegradation}
            disabled={marDegradationPct != null || !canApplyMarDegradation || isMarApplying}
          >
            <TrendingDownOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
            Apply MAR degradation
          </MenuItem>
        </Menu>
      </Stack>
      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 48,
            paddingY: 1,
            paddingX: 1.5,
          },
          '& .MuiTab-iconWrapper': {
            marginRight: 1,
          },
        }}
      >
        {reportTabs.map(({ label, value, icon }) => (
          <Tab key={value} label={label} value={value} icon={icon} iconPosition="start" />
        ))}
      </Tabs>
    </Box>
  )
}

export default ReportHeader
