import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from '@mui/material'
import type { PdfOrientation } from '../hooks/usePdfExport'

type PdfSettingsDialogProps = {
  open: boolean
  name: string
  orientation: PdfOrientation
  obfuscate: boolean
  onClose: () => void
  onNameChange: (name: string) => void
  onOrientationChange: (orientation: PdfOrientation) => void
  onObfuscateChange: (obfuscate: boolean) => void
  onGenerate: () => void
}

const PdfSettingsDialog = ({
  open,
  name,
  orientation,
  obfuscate,
  onClose,
  onNameChange,
  onOrientationChange,
  onObfuscateChange,
  onGenerate,
}: PdfSettingsDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Generate PDF report</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          label="Portfolio name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel id="pdf-orientation-label">Orientation</InputLabel>
          <Select
            labelId="pdf-orientation-label"
            value={orientation}
            label="Orientation"
            onChange={(event) => onOrientationChange(event.target.value as PdfOrientation)}
          >
            <MenuItem value="portrait">Portrait</MenuItem>
            <MenuItem value="landscape">Landscape</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={obfuscate}
              onChange={(event) => onObfuscateChange(event.target.checked)}
            />
          }
          label="Obfuscate sleeve and symbol names"
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button variant="text" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="contained" onClick={onGenerate}>
        Generate PDF
      </Button>
    </DialogActions>
  </Dialog>
)

export default PdfSettingsDialog
