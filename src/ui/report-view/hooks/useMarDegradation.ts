import { useCallback, useEffect, useRef, useState } from 'react'
import type { DealRow, ReportModel, UnderlyingSeries } from '../../../engine/types'
import type { DrawdownMode } from '../reportAnalytics'

type MarWorkerResponse = {
  requestId: number
  report: ReportModel
  appliedPct: number | null
}

type UseMarDegradationOptions = {
  report: ReportModel | null
  baseReport: ReportModel | null
  deals: DealRow[] | null
  baseDeals: DealRow[] | null
  appliedPct: number | null
  underlyingSeries: UnderlyingSeries[]
  underlyingTimeframes: Record<string, 'H1' | 'D1'>
  drawdownMode: DrawdownMode
  setReport: (report: ReportModel) => void
  setAppliedPct: (value: number | null) => void
}

export const clampMarDegradation = (value: number) => Math.max(0, Math.min(100, value))

export const useMarDegradation = ({
  report,
  baseReport,
  deals,
  baseDeals,
  appliedPct,
  underlyingSeries,
  underlyingTimeframes,
  drawdownMode,
  setReport,
  setAppliedPct,
}: UseMarDegradationOptions) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [input, setInput] = useState('10')
  const [isApplying, setIsApplying] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const sourceDeals = baseDeals ?? deals
  const canApply = !!sourceDeals?.length

  useEffect(() => {
    const worker = new Worker(new URL('../workers/marWorker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const run = useCallback(
    (targetPct: number) => {
      const worker = workerRef.current
      if (!report || !sourceDeals?.length || !worker) return Promise.resolve()
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      return new Promise<void>((resolve, reject) => {
        const handleMessage = (event: MessageEvent<MarWorkerResponse>) => {
          if (event.data.requestId !== requestId) return
          cleanup()
          setReport(event.data.report)
          setAppliedPct(event.data.appliedPct)
          resolve()
        }
        const handleError = (event: ErrorEvent) => {
          cleanup()
          reject(event.error)
        }
        const cleanup = () => {
          worker.removeEventListener('message', handleMessage)
          worker.removeEventListener('error', handleError)
        }

        worker.addEventListener('message', handleMessage)
        worker.addEventListener('error', handleError)
        worker.postMessage({
          requestId,
          deals: sourceDeals,
          underlyingSeries,
          underlyingTimeframes,
          drawdownMode,
          targetPct,
          dealsSourceName: baseReport?.dealsSourceName ?? report.dealsSourceName,
        })
      })
    },
    [
      baseReport?.dealsSourceName,
      drawdownMode,
      report,
      setAppliedPct,
      setReport,
      sourceDeals,
      underlyingSeries,
      underlyingTimeframes,
    ],
  )

  const apply = useCallback(() => {
    const parsed = Number(input)
    if (!report || !sourceDeals?.length || !Number.isFinite(parsed)) return
    const targetPct = clampMarDegradation(parsed)
    if (appliedPct != null && Math.abs(appliedPct - targetPct) < 1e-6) {
      setDialogOpen(false)
      return
    }
    setDialogOpen(false)
    setIsApplying(true)
    void run(targetPct).finally(() => setIsApplying(false))
  }, [appliedPct, input, report, run, sourceDeals])

  const remove = useCallback(() => {
    if (!report || !sourceDeals?.length) return
    setIsApplying(true)
    if (baseReport) {
      setReport(baseReport)
      setAppliedPct(null)
      setIsApplying(false)
      return
    }
    void run(0).finally(() => setIsApplying(false))
  }, [baseReport, report, run, setAppliedPct, setReport, sourceDeals])

  return {
    dialogOpen,
    input,
    isApplying,
    canApply,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    setInput,
    apply,
    remove,
  }
}
