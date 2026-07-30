import { useCallback, useMemo, useState } from 'react'
import type { MagicDealRow } from '../../../engine/parseDealsWithMagic'
import { parseDealsWithMagic } from '../../../engine/parseDealsWithMagic'
import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import { useReportStore } from '../../../store/report'
import { useUnderlyingStore } from '../../../store/underlying'
import { useWizardStore } from '../../../store/wizard'
import { parseUnderlyingFiles } from '../wizardFiles'
import {
  buildUnderlyingTimeframes,
  getDealSymbols,
  getGenerationIssues,
  getLoadingState,
  getMissingSymbols,
  parseSymbolFromFilename,
  type UnderlyingFiles,
  type UnderlyingUploadMode,
} from '../wizardModel'

export const useWizardWorkflow = () => {
  const activeStep = useWizardStore((state) => state.activeStep)
  const loading = useWizardStore((state) => state.loading)
  const setActiveStep = useWizardStore((state) => state.setActiveStep)
  const previousStep = useWizardStore((state) => state.prevStep)
  const setLoading = useWizardStore((state) => state.setLoading)
  const setReport = useReportStore((state) => state.setReport)
  const setDeals = useReportStore((state) => state.setDeals)
  const setBaseReport = useReportStore((state) => state.setBaseReport)
  const setBaseDeals = useReportStore((state) => state.setBaseDeals)
  const setAllUnderlying = useUnderlyingStore((state) => state.setAllUnderlying)
  const clearUnderlying = useUnderlyingStore((state) => state.clearUnderlying)
  const underlyingSeries = useUnderlyingStore((state) => state.seriesBySymbol)
  const [dealsFile, setDealsFile] = useState<File | null>(null)
  const [parsedDeals, setParsedDeals] = useState<MagicDealRow[]>([])
  const [underlyingMode, setUnderlyingMode] = useState<UnderlyingUploadMode>('perSymbol')
  const [underlyingFiles, setUnderlyingFiles] = useState<UnderlyingFiles>({})

  const symbols = useMemo(() => getDealSymbols(parsedDeals), [parsedDeals])
  const missingSymbols = useMemo(
    () => getMissingSymbols(symbols, underlyingFiles),
    [symbols, underlyingFiles],
  )
  const canProceedUnderlying = symbols.length > 0 && missingSymbols.length === 0
  const generationIssues = useMemo(
    () =>
      getGenerationIssues({
        hasDealsFile: dealsFile != null,
        parsedDealCount: parsedDeals.length,
        symbols,
        missingSymbols,
      }),
    [dealsFile, missingSymbols, parsedDeals.length, symbols],
  )
  const loadingState = useMemo(() => getLoadingState(loading), [loading])

  const removeDealsFile = useCallback(() => {
    setDealsFile(null)
    setParsedDeals([])
    setUnderlyingFiles({})
  }, [])

  const changeUnderlyingMode = useCallback((mode: UnderlyingUploadMode) => {
    setUnderlyingMode(mode)
    setUnderlyingFiles({})
  }, [])

  const setUnderlyingFile = useCallback((symbol: string, file: File) => {
    setUnderlyingFiles((current) => ({ ...current, [symbol]: file }))
  }, [])

  const removeUnderlyingFile = useCallback((symbol: string) => {
    setUnderlyingFiles((current) => {
      const next = { ...current }
      delete next[symbol]
      return next
    })
  }, [])

  const addBulkFiles = useCallback((files: File[]) => {
    setUnderlyingFiles((current) => {
      const next = { ...current }
      files.forEach((file) => {
        const symbol = parseSymbolFromFilename(file.name)
        if (symbol) next[symbol] = file
      })
      return next
    })
  }, [])

  const advance = useCallback(async () => {
    if (activeStep === 0) {
      if (!dealsFile) return
      setLoading('parsingDeals', true)
      try {
        setParsedDeals(parseDealsWithMagic(await dealsFile.arrayBuffer()))
        setUnderlyingFiles({})
        clearUnderlying()
        setActiveStep(1)
      } finally {
        setLoading('parsingDeals', false)
      }
      return
    }

    if (activeStep === 1 && canProceedUnderlying) {
      setLoading('parsingUnderlying', true)
      try {
        setAllUnderlying(await parseUnderlyingFiles(underlyingFiles, underlyingMode))
        setActiveStep(2)
      } finally {
        setLoading('parsingUnderlying', false)
      }
    }
  }, [
    activeStep,
    canProceedUnderlying,
    clearUnderlying,
    dealsFile,
    setActiveStep,
    setAllUnderlying,
    setLoading,
    underlyingFiles,
    underlyingMode,
  ])

  const generate = useCallback(() => {
    if (parsedDeals.length === 0 || missingSymbols.length > 0) return
    setLoading('computingReport', true)
    try {
      const report = buildPortfolioReport(parsedDeals, {
        generatedAt: Date.now(),
        dealsSourceName: dealsFile?.name,
        underlyingTimeframes: buildUnderlyingTimeframes(underlyingSeries),
        underlyingSeries: Object.values(underlyingSeries),
      })
      setBaseDeals(parsedDeals)
      setBaseReport(report)
      setDeals(parsedDeals)
      setReport(report)
    } finally {
      setLoading('computingReport', false)
    }
  }, [
    dealsFile?.name,
    missingSymbols.length,
    parsedDeals,
    setBaseDeals,
    setBaseReport,
    setDeals,
    setLoading,
    setReport,
    underlyingSeries,
  ])

  return {
    activeStep,
    dealsFile,
    parsedDeals,
    underlyingMode,
    underlyingFiles,
    symbols,
    missingSymbols,
    canProceedUnderlying,
    generationIssues,
    isLoading: loadingState.isLoading,
    loadingMessage: loadingState.message,
    selectDealsFile: setDealsFile,
    removeDealsFile,
    changeUnderlyingMode,
    setUnderlyingFile,
    removeUnderlyingFile,
    addBulkFiles,
    advance,
    generate,
    previousStep,
  }
}
