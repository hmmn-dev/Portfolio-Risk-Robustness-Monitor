import { buildPortfolioReport } from '../../../engine/portfolioSeries'
import type { DealRow, ReportModel, UnderlyingSeries } from '../../../engine/types'

type MarWorkerRequest = {
  requestId: number
  deals: DealRow[]
  underlyingSeries: UnderlyingSeries[]
  underlyingTimeframes: Record<string, 'H1' | 'D1'>
  drawdownMode: 'deal' | 'mtm'
  targetPct: number
  dealsSourceName?: string
}

type MarWorkerResponse = {
  requestId: number
  report: ReportModel
  appliedPct: number | null
}

const computeMarFromReport = (report: ReportModel, drawdownMode: 'deal' | 'mtm') => {
  const index = report.portfolio.index
  if (!index.length) return Number.NaN
  const startIndex = index[0]?.value ?? Number.NaN
  const endIndex = index[index.length - 1]?.value ?? Number.NaN
  const startTime = index[0]?.time ?? Number.NaN
  const endTime = index[index.length - 1]?.time ?? Number.NaN
  const years =
    Number.isFinite(startTime) && Number.isFinite(endTime)
      ? (endTime - startTime) / (365.25 * 24 * 60 * 60 * 1000)
      : Number.NaN
  const cagr =
    Number.isFinite(startIndex) &&
    Number.isFinite(endIndex) &&
    startIndex > 0 &&
    endIndex > 0 &&
    Number.isFinite(years) &&
    years > 0
      ? (Math.pow(endIndex / startIndex, 1 / years) - 1) * 100
      : Number.NaN
  const drawdown =
    drawdownMode === 'mtm' && report.portfolio.drawdownMtm?.length
      ? report.portfolio.drawdownMtm
      : report.portfolio.drawdown ?? []
  const maxDrawdown = drawdown.reduce(
    (min, point) => (point.value < min ? point.value : min),
    0
  )
  return maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : Number.NaN
}

const applySlippage = (inputDeals: DealRow[], slippagePct: number) => {
  const factor = Math.max(0, Math.min(slippagePct, 0.95))
  let cumulativeCost = 0
  return inputDeals.map((deal) => {
    const notional = deal.notional
    if (!Number.isFinite(notional)) return deal
    const cost = Math.abs(notional) * factor
    cumulativeCost += cost
    const profit = deal.profit
    return {
      ...deal,
      notional: notional - cost,
      balance: Number.isFinite(deal.balance ?? NaN)
        ? (deal.balance as number) - cumulativeCost
        : deal.balance,
      profit: Number.isFinite(profit ?? NaN)
        ? (profit as number) - Math.abs(profit as number) * factor
        : profit,
    }
  })
}

const buildReport = (
  deals: DealRow[],
  slippagePct: number,
  underlyingTimeframes: Record<string, 'H1' | 'D1'>,
  underlyingSeries: UnderlyingSeries[],
  dealsSourceName?: string
) =>
  buildPortfolioReport(applySlippage(deals, slippagePct), {
    generatedAt: Date.now(),
    dealsSourceName,
    underlyingTimeframes,
    underlyingSeries,
  })

self.onmessage = (event: MessageEvent<MarWorkerRequest>) => {
  const {
    requestId,
    deals,
    underlyingSeries,
    underlyingTimeframes,
    drawdownMode,
    targetPct,
    dealsSourceName,
  } = event.data

  const baseReport = buildReport(
    deals,
    0,
    underlyingTimeframes,
    underlyingSeries,
    dealsSourceName
  )
  const baseMar = computeMarFromReport(baseReport, drawdownMode)
  if (!Number.isFinite(baseMar) || baseMar <= 0 || targetPct === 0) {
    const response: MarWorkerResponse = { requestId, report: baseReport, appliedPct: null }
    self.postMessage(response)
    return
  }

  const targetMar = baseMar * (1 - targetPct / 100)
  let low = 0
  let high = 0.05
  let bestReport = baseReport

  for (let i = 0; i < 8; i += 1) {
    const candidate = buildReport(
      deals,
      high,
      underlyingTimeframes,
      underlyingSeries,
      dealsSourceName
    )
    const candidateMar = computeMarFromReport(candidate, drawdownMode)
    if (Number.isFinite(candidateMar) && candidateMar <= targetMar) {
      bestReport = candidate
      break
    }
    high = Math.min(high * 2, 0.9)
  }

  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2
    const candidate = buildReport(
      deals,
      mid,
      underlyingTimeframes,
      underlyingSeries,
      dealsSourceName
    )
    const candidateMar = computeMarFromReport(candidate, drawdownMode)
    if (!Number.isFinite(candidateMar)) {
      low = mid
      continue
    }
    if (candidateMar <= targetMar) {
      bestReport = candidate
      high = mid
    } else {
      low = mid
    }
  }

  const response: MarWorkerResponse = { requestId, report: bestReport, appliedPct: targetPct }
  self.postMessage(response)
}
