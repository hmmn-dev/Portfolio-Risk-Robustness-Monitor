import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
} from '@mui/material'

type PortfolioCompositionDialogProps = {
  open: boolean
  labels: string[]
  sleeveDraft: Set<string>
  weightDraft: Record<string, string>
  globalWeightDraft: string
  modified: boolean
  applyDisabled: boolean
  onClose: () => void
  onToggleSleeve: (label: string) => void
  onSelectAll: () => void
  onClear: () => void
  onUpdateWeight: (label: string, value: string) => void
  onUpdateGlobalWeight: (value: string) => void
  onApplyGlobalWeight: () => void
  onResetWeights: () => void
  onResetToBaseline: () => void
  onApply: () => void
}

const PortfolioCompositionDialog = ({
  open,
  labels,
  sleeveDraft,
  weightDraft,
  globalWeightDraft,
  modified,
  applyDisabled,
  onClose,
  onToggleSleeve,
  onSelectAll,
  onClear,
  onUpdateWeight,
  onUpdateGlobalWeight,
  onApplyGlobalWeight,
  onResetWeights,
  onResetToBaseline,
  onApply,
}: PortfolioCompositionDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    aria-labelledby="portfolio-composition-title"
    maxWidth="lg"
    fullWidth
    sx={{ '& .MuiDialog-paper': { maxWidth: 1024 } }}
  >
    <DialogTitle id="portfolio-composition-title">Change portfolio composition</DialogTitle>
    <DialogContent>
      {modified && (
        <Alert
          severity="info"
          variant="outlined"
          action={
            <Button size="small" onClick={onResetToBaseline}>
              Reset to baseline
            </Button>
          }
          sx={{ mb: 2, alignItems: 'center' }}
        >
          Custom portfolio active. Weights multiply each sleeve's return exposure; 1.00 preserves
          its baseline contribution.
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Button size="small" onClick={onSelectAll} disabled={sleeveDraft.size === labels.length}>
          Select all
        </Button>
        <Button size="small" onClick={onClear}>
          Clear
        </Button>
        <Button size="small" onClick={onResetWeights}>
          Reset weights
        </Button>
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="All sleeves weight"
          size="small"
          value={globalWeightDraft}
          onChange={(event) => onUpdateGlobalWeight(event.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal', step: 0.01 } }}
          sx={{ width: 220 }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={onApplyGlobalWeight}
          disabled={globalWeightDraft === ''}
        >
          Apply to all
        </Button>
      </Stack>
      <Stack spacing={1.5}>
        {labels.map((label) => (
          <Stack key={label} direction="row" spacing={1.5} alignItems="center">
            <FormControlLabel
              sx={{ m: 0, flex: 1 }}
              control={
                <Checkbox checked={sleeveDraft.has(label)} onChange={() => onToggleSleeve(label)} />
              }
              label={label}
            />
            <TextField
              label="Weight"
              size="small"
              value={weightDraft[label] ?? ''}
              onChange={(event) => onUpdateWeight(label, event.target.value)}
              slotProps={{ htmlInput: { inputMode: 'decimal', step: 0.01 } }}
              sx={{ width: 120 }}
            />
          </Stack>
        ))}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button variant="text" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="contained" onClick={onApply} disabled={applyDisabled}>
        Apply
      </Button>
    </DialogActions>
  </Dialog>
)

export default PortfolioCompositionDialog
