import {
  Backdrop,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'

const STEPS = ['Deals upload', 'Underlying upload', 'Generate']

type WizardLayoutProps = {
  activeStep: number
  isLoading: boolean
  loadingMessage: string
  primaryLabel: string
  primaryDisabled: boolean
  onBack: () => void
  onPrimary: () => void
  children: ReactNode
}

const WizardLayout = ({
  activeStep,
  isLoading,
  loadingMessage,
  primaryLabel,
  primaryDisabled,
  onBack,
  onPrimary,
  children,
}: WizardLayoutProps) => (
  <Stack spacing={3}>
    <Typography variant="h3">Report Generation Wizard</Typography>
    <Paper sx={{ p: 3 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {children}
      <Stack direction="row" spacing={2} sx={{ mt: 3, alignItems: 'center' }}>
        <Button variant="text" disabled={isLoading || activeStep === 0} onClick={onBack}>
          Back
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" onClick={onPrimary} disabled={isLoading || primaryDisabled}>
          {primaryLabel}
        </Button>
      </Stack>
    </Paper>
    <Backdrop open={isLoading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2 }}>
      <Box sx={{ minWidth: 320, px: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {loadingMessage}
        </Typography>
        <LinearProgress />
      </Box>
    </Backdrop>
  </Stack>
)

export default WizardLayout
