import { Backdrop, Box, LinearProgress } from '@mui/material'

const ProgressBackdrop = ({ open, layer }: { open: boolean; layer: number }) => (
  <Backdrop open={open} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + layer }}>
    <Box sx={{ width: '40%' }}>
      <LinearProgress />
    </Box>
  </Backdrop>
)

const ReportBusyOverlays = ({
  sleevePending,
  pdfGenerating,
  marApplying,
}: {
  sleevePending: boolean
  pdfGenerating: boolean
  marApplying: boolean
}) => (
  <>
    <ProgressBackdrop open={sleevePending} layer={1} />
    <ProgressBackdrop open={pdfGenerating} layer={2} />
    <ProgressBackdrop open={marApplying} layer={3} />
  </>
)

export default ReportBusyOverlays
