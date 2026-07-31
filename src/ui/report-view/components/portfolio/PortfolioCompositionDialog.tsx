import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { memo, useCallback, useMemo, useReducer } from 'react'
import {
  areSortedSleevesEqual,
  buildDefaultWeights,
  buildWeightDraft,
  hasModifiedWeightDraft,
  isWeightDraftValid,
  isWeightInputValue,
  normalizeWeightDraft,
  resolveGlobalWeightDraft,
  sortSleeves,
} from '../../portfolio/portfolioWeights'

type PortfolioCompositionDialogProps = {
  labels: string[]
  enabledSleeves: ReadonlySet<string>
  sleeveWeights: Record<string, number>
  modified: boolean
  onClose: () => void
  onResetToBaseline: () => void
  onApply: (enabledSleeves: ReadonlySet<string>, sleeveWeights: Record<string, number>) => void
}

type CompositionDraft = {
  labels: string[]
  sleeveDraft: Set<string>
  weightDraft: Record<string, string>
  globalWeightDraft: string
}

type CompositionDraftAction =
  | { type: 'toggle-sleeve'; label: string }
  | { type: 'select-all' }
  | { type: 'clear' }
  | { type: 'update-weight'; label: string; value: string }
  | { type: 'update-global-weight'; value: string }
  | { type: 'apply-global-weight' }
  | { type: 'reset-weights' }
  | { type: 'reset-baseline' }

const createCompositionDraft = (
  labels: string[],
  enabledSleeves: ReadonlySet<string>,
  sleeveWeights: Record<string, number>,
): CompositionDraft => {
  const weightDraft = buildWeightDraft(labels, sleeveWeights)
  return {
    labels,
    sleeveDraft: new Set(enabledSleeves),
    weightDraft,
    globalWeightDraft: resolveGlobalWeightDraft(weightDraft, labels),
  }
}

const compositionDraftReducer = (
  state: CompositionDraft,
  action: CompositionDraftAction,
): CompositionDraft => {
  switch (action.type) {
    case 'toggle-sleeve': {
      const sleeveDraft = new Set(state.sleeveDraft)
      if (sleeveDraft.has(action.label)) sleeveDraft.delete(action.label)
      else sleeveDraft.add(action.label)
      return { ...state, sleeveDraft }
    }
    case 'select-all':
      return { ...state, sleeveDraft: new Set(state.labels) }
    case 'clear':
      return { ...state, sleeveDraft: new Set() }
    case 'update-weight': {
      if (!isWeightInputValue(action.value)) return state
      const weightDraft = { ...state.weightDraft, [action.label]: action.value }
      return {
        ...state,
        weightDraft,
        globalWeightDraft: resolveGlobalWeightDraft(weightDraft, state.labels),
      }
    }
    case 'update-global-weight':
      return isWeightInputValue(action.value)
        ? { ...state, globalWeightDraft: action.value }
        : state
    case 'apply-global-weight':
      return state.globalWeightDraft === ''
        ? state
        : {
            ...state,
            weightDraft: Object.fromEntries(
              state.labels.map((label) => [label, state.globalWeightDraft]),
            ),
          }
    case 'reset-weights': {
      const weightDraft = buildWeightDraft(state.labels, buildDefaultWeights(state.labels))
      return { ...state, weightDraft, globalWeightDraft: '1.00' }
    }
    case 'reset-baseline': {
      const weightDraft = buildWeightDraft(state.labels, buildDefaultWeights(state.labels))
      return {
        ...state,
        sleeveDraft: new Set(state.labels),
        weightDraft,
        globalWeightDraft: '1.00',
      }
    }
  }
  return state
}

type PortfolioCompositionRowProps = {
  label: string
  checked: boolean
  weight: string
  onToggle: (label: string) => void
  onWeightChange: (label: string, value: string) => void
}

const PortfolioCompositionRow = memo(
  ({ label, checked, weight, onToggle, onWeightChange }: PortfolioCompositionRowProps) => (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <FormControlLabel
        sx={{ m: 0, flex: 1 }}
        control={<Checkbox checked={checked} onChange={() => onToggle(label)} />}
        label={label}
      />
      <TextField
        label="Weight"
        size="small"
        value={weight}
        onChange={(event) => onWeightChange(label, event.target.value)}
        slotProps={{ htmlInput: { inputMode: 'decimal', step: 0.01 } }}
        sx={{ width: 120 }}
      />
    </Stack>
  ),
)

const PortfolioCompositionDialog = ({
  labels,
  enabledSleeves,
  sleeveWeights,
  modified,
  onClose,
  onResetToBaseline,
  onApply,
}: PortfolioCompositionDialogProps) => {
  const initialDraft = useMemo(
    () => createCompositionDraft(labels, enabledSleeves, sleeveWeights),
    [enabledSleeves, labels, sleeveWeights],
  )
  const [draft, dispatch] = useReducer(compositionDraftReducer, initialDraft)
  const draftModified = useMemo(
    () =>
      !areSortedSleevesEqual(sortSleeves(draft.sleeveDraft), draft.labels) ||
      hasModifiedWeightDraft(draft.labels, draft.weightDraft),
    [draft.labels, draft.sleeveDraft, draft.weightDraft],
  )
  const isModified = modified || draftModified
  const applyDisabled =
    draft.sleeveDraft.size === 0 || !isWeightDraftValid(draft.labels, draft.weightDraft)
  const handleToggleSleeve = useCallback(
    (label: string) => dispatch({ type: 'toggle-sleeve', label }),
    [],
  )
  const handleWeightChange = useCallback(
    (label: string, value: string) => dispatch({ type: 'update-weight', label, value }),
    [],
  )
  const handleResetToBaseline = useCallback(() => {
    dispatch({ type: 'reset-baseline' })
    onResetToBaseline()
  }, [onResetToBaseline])
  const handleApply = useCallback(() => {
    if (applyDisabled) return
    onApply(new Set(draft.sleeveDraft), normalizeWeightDraft(draft.labels, draft.weightDraft))
  }, [applyDisabled, draft.labels, draft.sleeveDraft, draft.weightDraft, onApply])

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="portfolio-composition-title"
      maxWidth="lg"
      fullWidth
      sx={{ '& .MuiDialog-paper': { maxWidth: 1024 } }}
    >
      <DialogTitle id="portfolio-composition-title">Change portfolio composition</DialogTitle>
      <DialogContent>
        <Stack
          component="section"
          aria-label="Portfolio composition status"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2, minHeight: { xs: 64, sm: 40 } }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Chip
              size="small"
              label={isModified ? 'Custom portfolio' : 'Baseline portfolio'}
              color={isModified ? 'info' : 'default'}
              variant="outlined"
            />
            <Typography variant="caption" color="text.secondary">
              Weights scale return exposure; 1.00 preserves each sleeve's baseline contribution.
            </Typography>
          </Stack>
          <Button
            size="small"
            onClick={handleResetToBaseline}
            aria-hidden={!isModified}
            tabIndex={isModified ? 0 : -1}
            sx={{ visibility: isModified ? 'visible' : 'hidden', flexShrink: 0 }}
          >
            Reset to baseline
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Button
            size="small"
            onClick={() => dispatch({ type: 'select-all' })}
            disabled={draft.sleeveDraft.size === draft.labels.length}
          >
            Select all
          </Button>
          <Button size="small" onClick={() => dispatch({ type: 'clear' })}>
            Clear
          </Button>
          <Button size="small" onClick={() => dispatch({ type: 'reset-weights' })}>
            Reset weights
          </Button>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
          <TextField
            label="All sleeves weight"
            size="small"
            value={draft.globalWeightDraft}
            onChange={(event) =>
              dispatch({ type: 'update-global-weight', value: event.target.value })
            }
            slotProps={{ htmlInput: { inputMode: 'decimal', step: 0.01 } }}
            sx={{ width: 220 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => dispatch({ type: 'apply-global-weight' })}
            disabled={draft.globalWeightDraft === ''}
          >
            Apply to all
          </Button>
        </Stack>
        <Stack spacing={1.5}>
          {draft.labels.map((label) => (
            <PortfolioCompositionRow
              key={label}
              label={label}
              checked={draft.sleeveDraft.has(label)}
              weight={draft.weightDraft[label] ?? ''}
              onToggle={handleToggleSleeve}
              onWeightChange={handleWeightChange}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleApply} disabled={applyDisabled}>
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PortfolioCompositionDialog
