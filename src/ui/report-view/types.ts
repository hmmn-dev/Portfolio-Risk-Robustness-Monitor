import type { DailyPoint } from '../../engine/types'

export type PerformanceRow = {
  id: number
  sleeve: string
  symbol: string
  totalPnl: number
  meanAnn: number
  sharpe: number
  last6mPnl: number
  last6mMeanAnn: number
  last6mSharpe: number
}

export type RiskRow = {
  id: number
  sleeve: string
  symbol: string
  status: string
  shock: string
  alphaPct: number | null
  winratePctile: number | null
  last3mSharpe: number | null
  last6mSharpe: number | null
  last6mWinrate: number | null
  last6mExpectancy: number | null
  statusReasons: string
  statusAction: string
}

export type PortfolioRegression = {
  n: number
  alphaAnn: number
  betas: { symbol: string; beta: number }[]
  r2: number
}

export type PortfolioSummary = {
  totalReturnPct: number
  cagr: number
  maxDrawdown: number
  mar: number
  sharpe: number
  regression: PortfolioRegression | null
}

export type CorrelationMatrix = {
  labels: string[]
  values: Array<Array<number | null>>
}

export type SleeveDrawdownSource = 'H1' | 'D1' | undefined

export type SleeveDrawdownSeries = DailyPoint[]
