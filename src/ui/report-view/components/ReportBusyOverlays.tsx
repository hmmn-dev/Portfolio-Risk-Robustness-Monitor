import ProgressBackdrop from '../../ProgressBackdrop'

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
    <ProgressBackdrop
      open={sleevePending}
      label="Updating strategy view"
      zIndexOffset={1}
      compact
    />
    <ProgressBackdrop open={pdfGenerating} label="Generating PDF" zIndexOffset={2} compact />
    <ProgressBackdrop open={marApplying} label="Applying MAR adjustment" zIndexOffset={3} compact />
  </>
)

export default ReportBusyOverlays
