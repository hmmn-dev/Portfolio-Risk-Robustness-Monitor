import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'

type MarDegradationDialogProps = {
  open: boolean
  value: string
  canApply: boolean
  isApplying: boolean
  onClose: () => void
  onValueChange: (value: string) => void
  onApply: () => void
}

const MarDegradationDialog = ({
  open,
  value,
  canApply,
  isApplying,
  onClose,
  onValueChange,
  onApply,
}: MarDegradationDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Apply MAR degradation</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          label="Degrade MAR by (%)"
          type="number"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          helperText="Adds slippage to all trades to reduce MAR by the chosen percentage."
          fullWidth
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button variant="text" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="contained" onClick={onApply} disabled={!canApply || isApplying}>
        Apply
      </Button>
    </DialogActions>
  </Dialog>
)

export default MarDegradationDialog
