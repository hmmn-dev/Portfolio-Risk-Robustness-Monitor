import {
  Alert,
  Backdrop,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import type { DragEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined'
import { useWizardStore } from '../store/wizard'
import { parseDealsWithMagic } from '../engine/parseDealsWithMagic'
import type { MagicDealRow } from '../engine/parseDealsWithMagic'
import { buildPortfolioReport } from '../engine/portfolioSeries'
import { useReportStore } from '../store/report'
import { normalizeUnderlyingSeries, parseUnderlying } from '../engine/underlying'
import { useUnderlyingStore } from '../store/underlying'

const steps = ['Deals upload', 'Underlying upload', 'Generate']

const loadingMessages = {
  parsingDeals: 'Parsing deals file...',
  parsingUnderlying: 'Parsing underlying file...',
  computingReport: 'Computing report...',
}

const Wizard = () => {
  const activeStep = useWizardStore((state) => state.activeStep)
  const loading = useWizardStore((state) => state.loading)
  const setActiveStep = useWizardStore((state) => state.setActiveStep)
  const prevStep = useWizardStore((state) => state.prevStep)
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
  const [underlyingMode, setUnderlyingMode] = useState<'perSymbol' | 'bulk'>('perSymbol')
  const [underlyingFiles, setUnderlyingFiles] = useState<Record<string, File>>({})

  const timeoutRef = useRef<number | null>(null)
  const isLoading = useMemo(() => Object.values(loading).some(Boolean), [loading])
  const loadingMessage = useMemo(() => {
    const activeKey = Object.keys(loading).find((key) => loading[key as keyof typeof loading])
    return activeKey ? loadingMessages[activeKey as keyof typeof loadingMessages] : ''
  }, [loading])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleNext = async () => {
    if (activeStep === 0) {
      if (!dealsFile) return
      setLoading('parsingDeals', true)
      try {
        const buffer = await dealsFile.arrayBuffer()
        const rows = parseDealsWithMagic(buffer)
        console.log('Parsed deals rows:', rows)
        setParsedDeals(rows)
        setUnderlyingFiles({})
        clearUnderlying()
        setActiveStep(1)
      } finally {
        setLoading('parsingDeals', false)
      }
      return
    }
    if (activeStep === 1) {
      if (!canProceedUnderlying) return
      setLoading('parsingUnderlying', true)
      try {
        const entries: Record<string, ReturnType<typeof parseUnderlying>> = {}
        for (const [symbolKey, file] of Object.entries(underlyingFiles)) {
          const text = await file.text()
          const parsed = parseUnderlying(text, {
            symbol: underlyingMode === 'perSymbol' ? symbolKey : undefined,
            sourceName: file.name,
          })
          const symbol = parsed.symbol || symbolKey.toUpperCase()
          const existing = entries[symbol]
          if (existing) {
            entries[symbol] = normalizeUnderlyingSeries(symbol, [
              ...existing.candles,
              ...parsed.candles,
            ])
          } else {
            entries[symbol] = parsed
          }
        }
        setAllUnderlying(entries)
        setActiveStep(2)
      } finally {
        setLoading('parsingUnderlying', false)
      }
    }
  }

  const handleGenerate = () => {
    if (parsedDeals.length === 0 || missingSymbols.length > 0) return
    setLoading('computingReport', true)
    try {
      const underlyingTimeframes: Record<string, 'H1' | 'D1'> = {}
      Object.entries(underlyingSeries).forEach(([symbol, series]) => {
        underlyingTimeframes[symbol] = series.timeframe
      })
      const report = buildPortfolioReport(parsedDeals, {
        generatedAt: Date.now(),
        dealsSourceName: dealsFile?.name,
        underlyingTimeframes,
        underlyingSeries: Object.values(underlyingSeries),
      })
      setBaseDeals(parsedDeals)
      setBaseReport(report)
      setDeals(parsedDeals)
      setReport(report)
    } finally {
      setLoading('computingReport', false)
    }
  }

  const handleDealsUpload = (file: File) => {
    setDealsFile(file)
  }

  const handleDrop = (
    event: DragEvent<HTMLLabelElement>,
    onFile: (file: File) => void,
    multiple = false
  ) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    if (multiple) {
      files.forEach((file) => onFile(file))
      return
    }
    onFile(files[0])
  }

  const symbols = useMemo(() => {
    const set = new Set<string>()
    parsedDeals.forEach((row) => {
      if (row.symbol) set.add(row.symbol)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [parsedDeals])

  const parseSymbolFromFilename = (filename: string) => {
    const match = filename.match(/^([A-Za-z0-9]+)[_-](H1|D1)/)
    if (match) return match[1]
    const parts = filename.split('_')
    return parts[0] || ''
  }

  const missingSymbols = useMemo(
    () => symbols.filter((symbol) => !underlyingFiles[symbol]),
    [symbols, underlyingFiles]
  )

  const canProceedUnderlying = symbols.length > 0 && missingSymbols.length === 0

  const stepContent = (() => {
    if (activeStep === 0) {
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle1">Upload the deals file</Typography>
          <Typography variant="body2" color="text.secondary">
            Import raw deal entries to establish exposure coverage and allocation rules.
          </Typography>
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
            onDrop={(event) => handleDrop(event, handleDealsUpload)}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Deals CSV</Typography>
              <Typography variant="body2" color="text.secondary">
                {dealsFile ? dealsFile.name : 'Drag & drop file here or click to browse'}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {dealsFile && (
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setDealsFile(null)
                      setParsedDeals([])
                      setUnderlyingFiles({})
                    }}
                    aria-label="Remove deals file"
                  >
                  <ClearOutlinedIcon fontSize="small" />
                </IconButton>
              )}
              <Button variant="outlined" component="span" disabled={isLoading}>
                {dealsFile ? 'Replace' : 'Select file'}
              </Button>
            </Stack>
            <input
              type="file"
              hidden
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleDealsUpload(file)
                }
              }}
            />
          </Paper>
        </Stack>
      )
    }
    if (activeStep === 1) {
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle1">Upload the underlying file</Typography>
          <Typography variant="body2" color="text.secondary">
            Provide H1 or D1 candle data for each symbol in the deals file.
          </Typography>
          <RadioGroup
            row
            value={underlyingMode}
            onChange={(event) => {
              const value = event.target.value as 'perSymbol' | 'bulk'
              setUnderlyingMode(value)
              setUnderlyingFiles({})
            }}
          >
            <FormControlLabel value="perSymbol" control={<Radio />} label="Upload per symbol" />
            <FormControlLabel value="bulk" control={<Radio />} label="Bulk upload" />
          </RadioGroup>
          {symbols.length === 0 ? (
            <Alert severity="info">Parse deals first to determine required symbols.</Alert>
          ) : underlyingMode === 'perSymbol' ? (
            <Stack spacing={2}>
              {symbols.map((symbol) => (
                <Paper
                  key={symbol}
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
                  onDrop={(event) =>
                    handleDrop(event, (file) => {
                      setUnderlyingFiles((prev) => ({ ...prev, [symbol]: file }))
                    })
                  }
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{symbol}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {underlyingFiles[symbol]?.name ??
                        'Drag & drop file here or click to browse'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {underlyingFiles[symbol] && (
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setUnderlyingFiles((prev) => {
                            const next = { ...prev }
                            delete next[symbol]
                            return next
                          })
                        }}
                        aria-label={`Remove ${symbol} file`}
                      >
                        <ClearOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Button variant="outlined" component="span" disabled={isLoading}>
                      {underlyingFiles[symbol] ? 'Replace' : 'Select file'}
                    </Button>
                  </Stack>
                  <input
                    type="file"
                    hidden
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        setUnderlyingFiles((prev) => ({ ...prev, [symbol]: file }))
                      }
                    }}
                  />
                </Paper>
              ))}
            </Stack>
          ) : (
            <Stack spacing={2}>
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
                onDrop={(event) =>
                  handleDrop(
                    event,
                    (file) => {
                      const symbol = parseSymbolFromFilename(file.name)
                      if (!symbol) return
                      setUnderlyingFiles((prev) => ({ ...prev, [symbol]: file }))
                    },
                    true
                  )
                }
              >
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Bulk upload</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Drag & drop files here or click to browse
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="outlined" component="span" disabled={isLoading}>
                    Select files
                  </Button>
                </Stack>
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    if (files.length === 0) return
                    setUnderlyingFiles((prev) => {
                      const next = { ...prev }
                      files.forEach((file) => {
                        const symbol = parseSymbolFromFilename(file.name)
                        if (symbol) {
                          next[symbol] = file
                        }
                      })
                      return next
                    })
                  }}
                />
              </Paper>
              {Object.keys(underlyingFiles).length > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Uploaded files</Typography>
                  {Object.entries(underlyingFiles).map(([symbol, file]) => (
                    <Stack key={symbol} direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ minWidth: 80 }}>
                        {symbol}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {file.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setUnderlyingFiles((prev) => {
                            const next = { ...prev }
                            delete next[symbol]
                            return next
                          })
                        }}
                        aria-label={`Remove ${symbol} file`}
                      >
                        <ClearOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
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
    }
    const issues: string[] = []
    if (!dealsFile) {
      issues.push('Deals file is missing.')
    }
    if (parsedDeals.length === 0) {
      issues.push('Deals are not parsed yet.')
    }
    if (symbols.length === 0) {
      issues.push('No symbols detected from deals.')
    }
    if (missingSymbols.length > 0) {
      issues.push(`Missing candle files for: ${missingSymbols.join(', ')}`)
    }
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
  })()

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h3">Report Generation Wizard</Typography>
        {/*<Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>*/}
        {/*  Guided setup for structured rebalancing. Steps and forms will land here.*/}
        {/*</Typography>*/}
      </div>
      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {stepContent}
        <Stack direction="row" spacing={2} sx={{ mt: 3, alignItems: 'center' }}>
          <Button variant="text" disabled={isLoading || activeStep === 0} onClick={prevStep}>
            Back
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {activeStep < 2 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                isLoading ||
                (activeStep === 0 && !dealsFile) ||
                (activeStep === 1 && !canProceedUnderlying)
              }
            >
              {activeStep === 1 ? 'Parse underlying' : 'Parse deals'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={isLoading || parsedDeals.length === 0 || missingSymbols.length > 0}
            >
              Generate report
            </Button>
          )}
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
}

export default Wizard
