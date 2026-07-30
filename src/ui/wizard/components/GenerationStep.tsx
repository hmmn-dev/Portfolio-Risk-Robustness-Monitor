import { Alert, Stack, Typography } from '@mui/material'

const GenerationStep = ({ issues }: { issues: string[] }) => {
  const isReady = issues.length === 0

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Ready to generate</Typography>
      <Typography variant="body2" color="text.secondary">
        {isReady
          ? 'All required inputs are available. You can generate the report.'
          : 'Resolve the issues below to continue.'}
      </Typography>
      {isReady ? (
        <Alert severity="success">All checks passed.</Alert>
      ) : (
        <Alert severity="error">
          {issues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </Alert>
      )}
    </Stack>
  )
}

export default GenerationStep
