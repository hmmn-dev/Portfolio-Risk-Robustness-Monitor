import DealsUploadStep from './wizard/components/DealsUploadStep'
import GenerationStep from './wizard/components/GenerationStep'
import UnderlyingUploadStep from './wizard/components/UnderlyingUploadStep'
import WizardLayout from './wizard/components/WizardLayout'
import { useWizardWorkflow } from './wizard/hooks/useWizardWorkflow'

const Wizard = () => {
  const workflow = useWizardWorkflow()
  const isGenerationStep = workflow.activeStep === 2
  const primaryLabel = isGenerationStep
    ? 'Generate report'
    : workflow.activeStep === 1
      ? 'Parse underlying'
      : 'Parse deals'
  const primaryDisabled = isGenerationStep
    ? workflow.parsedDeals.length === 0 || workflow.missingSymbols.length > 0
    : workflow.activeStep === 1
      ? !workflow.canProceedUnderlying
      : !workflow.dealsFile

  return (
    <WizardLayout
      activeStep={workflow.activeStep}
      isLoading={workflow.isLoading}
      loadingMessage={workflow.loadingMessage}
      primaryLabel={primaryLabel}
      primaryDisabled={primaryDisabled}
      onBack={workflow.previousStep}
      onPrimary={isGenerationStep ? workflow.generate : workflow.advance}
    >
      {workflow.activeStep === 0 ? (
        <DealsUploadStep
          file={workflow.dealsFile}
          disabled={workflow.isLoading}
          onFileSelected={workflow.selectDealsFile}
          onFileRemoved={workflow.removeDealsFile}
        />
      ) : workflow.activeStep === 1 ? (
        <UnderlyingUploadStep
          mode={workflow.underlyingMode}
          symbols={workflow.symbols}
          files={workflow.underlyingFiles}
          missingSymbols={workflow.missingSymbols}
          disabled={workflow.isLoading}
          onModeChange={workflow.changeUnderlyingMode}
          onFileSelected={workflow.setUnderlyingFile}
          onFileRemoved={workflow.removeUnderlyingFile}
          onBulkFilesSelected={workflow.addBulkFiles}
        />
      ) : (
        <GenerationStep issues={workflow.generationIssues} />
      )}
    </WizardLayout>
  )
}

export default Wizard
