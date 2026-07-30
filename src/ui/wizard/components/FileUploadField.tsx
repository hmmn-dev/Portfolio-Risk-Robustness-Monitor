import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined'
import { Button, IconButton, Paper, Stack, Typography } from '@mui/material'
import type { DragEvent } from 'react'

type FileUploadFieldProps = {
  title: string
  file?: File
  emptyText: string
  selectLabel: string
  disabled: boolean
  multiple?: boolean
  onFilesSelected: (files: File[]) => void
  onRemove?: () => void
  removeLabel?: string
}

const FileUploadField = ({
  title,
  file,
  emptyText,
  selectLabel,
  disabled,
  multiple = false,
  onFilesSelected,
  onRemove,
  removeLabel,
}: FileUploadFieldProps) => {
  const selectFiles = (files: File[]) => {
    if (files.length === 0) return
    onFilesSelected(multiple ? files : [files[0]])
  }
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    selectFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <Paper
      variant="outlined"
      component="label"
      sx={{
        p: 2,
        borderStyle: 'dashed',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {file?.name ?? emptyText}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        {file && onRemove && (
          <IconButton
            size="small"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove()
            }}
            aria-label={removeLabel ?? `Remove ${title} file`}
          >
            <ClearOutlinedIcon fontSize="small" />
          </IconButton>
        )}
        <Button variant="outlined" component="span" disabled={disabled}>
          {selectLabel}
        </Button>
      </Stack>
      <input
        aria-label={`${title} file input`}
        type="file"
        hidden
        multiple={multiple}
        accept=".csv,text/csv"
        onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
      />
    </Paper>
  )
}

export default FileUploadField
