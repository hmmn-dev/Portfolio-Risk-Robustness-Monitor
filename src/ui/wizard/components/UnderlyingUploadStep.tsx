import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined'
import {
  Alert,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import type { UnderlyingFiles, UnderlyingUploadMode } from '../wizardModel'
import FileUploadField from './FileUploadField'

type UnderlyingUploadStepProps = {
  mode: UnderlyingUploadMode
  symbols: string[]
  files: UnderlyingFiles
  missingSymbols: string[]
  disabled: boolean
  onModeChange: (mode: UnderlyingUploadMode) => void
  onFileSelected: (symbol: string, file: File) => void
  onFileRemoved: (symbol: string) => void
  onBulkFilesSelected: (files: File[]) => void
}

const UploadedFiles = ({
  files,
  onRemove,
}: {
  files: UnderlyingFiles
  onRemove: (symbol: string) => void
}) => {
  const entries = Object.entries(files)
  if (entries.length === 0) return null

  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2">Uploaded files</Typography>
      {entries.map(([symbol, file]) => (
        <Stack key={symbol} direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ minWidth: 80 }}>
            {symbol}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {file.name}
          </Typography>
          <IconButton
            size="small"
            onClick={() => onRemove(symbol)}
            aria-label={`Remove ${symbol} file`}
          >
            <ClearOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
    </Stack>
  )
}

const UnderlyingUploadStep = ({
  mode,
  symbols,
  files,
  missingSymbols,
  disabled,
  onModeChange,
  onFileSelected,
  onFileRemoved,
  onBulkFilesSelected,
}: UnderlyingUploadStepProps) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1">Upload the underlying file</Typography>
    <Typography variant="body2" color="text.secondary">
      Provide H1 or D1 candle data for each symbol in the deals file.
    </Typography>
    <RadioGroup
      row
      value={mode}
      onChange={(event) => onModeChange(event.target.value as UnderlyingUploadMode)}
    >
      <FormControlLabel value="perSymbol" control={<Radio />} label="Upload per symbol" />
      <FormControlLabel value="bulk" control={<Radio />} label="Bulk upload" />
    </RadioGroup>
    {symbols.length === 0 ? (
      <Alert severity="info">Parse deals first to determine required symbols.</Alert>
    ) : mode === 'perSymbol' ? (
      <Stack spacing={2}>
        {symbols.map((symbol) => (
          <FileUploadField
            key={symbol}
            title={symbol}
            file={files[symbol]}
            emptyText="Drag & drop file here or click to browse"
            selectLabel={files[symbol] ? 'Replace' : 'Select file'}
            disabled={disabled}
            onFilesSelected={([file]) => {
              if (file) onFileSelected(symbol, file)
            }}
            onRemove={() => onFileRemoved(symbol)}
            removeLabel={`Remove ${symbol} file`}
          />
        ))}
      </Stack>
    ) : (
      <Stack spacing={2}>
        <FileUploadField
          title="Bulk upload"
          emptyText="Drag & drop files here or click to browse"
          selectLabel="Select files"
          disabled={disabled}
          multiple
          onFilesSelected={onBulkFilesSelected}
        />
        <UploadedFiles files={files} onRemove={onFileRemoved} />
        <Typography variant="caption" color="text.secondary">
          File names should look like `XAUUSD_H1_201801020100_202601071400.csv`.
        </Typography>
      </Stack>
    )}
    {missingSymbols.length > 0 && (
      <Alert severity="warning">
        Missing candle files for: {missingSymbols.join(', ')}. Upload them to continue.
      </Alert>
    )}
  </Stack>
)

export default UnderlyingUploadStep
