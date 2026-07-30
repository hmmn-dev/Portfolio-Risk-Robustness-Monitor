import { Stack, Typography } from '@mui/material'
import FileUploadField from './FileUploadField'

type DealsUploadStepProps = {
  file: File | null
  disabled: boolean
  onFileSelected: (file: File) => void
  onFileRemoved: () => void
}

const DealsUploadStep = ({
  file,
  disabled,
  onFileSelected,
  onFileRemoved,
}: DealsUploadStepProps) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1">Upload the deals file</Typography>
    <Typography variant="body2" color="text.secondary">
      Import raw deal entries to establish exposure coverage and allocation rules.
    </Typography>
    <FileUploadField
      title="Deals CSV"
      file={file ?? undefined}
      emptyText="Drag & drop file here or click to browse"
      selectLabel={file ? 'Replace' : 'Select file'}
      disabled={disabled}
      onFilesSelected={([selected]) => {
        if (selected) onFileSelected(selected)
      }}
      onRemove={onFileRemoved}
      removeLabel="Remove deals file"
    />
  </Stack>
)

export default DealsUploadStep
