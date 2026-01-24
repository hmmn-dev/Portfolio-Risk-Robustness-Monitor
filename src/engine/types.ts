export type SleeveKey = string

export type DealRow = {
  deal: string
  time: number
  sleeve: SleeveKey
  notional: number
  symbol?: string
  balance?: number
  price?: number
  side?: 'buy' | 'sell'
  volume?: number
  entry?: string
  entryType?: 'in' | 'out' | 'unknown'
  profit?: number
  commission?: number
  swap?: number
  positionId?: number
  magic?: number
  _seq: number
}

export type UnderlyingDailyReturn = {
  symbol: string
  time: number
  close: number
  return: number
}

export type UnderlyingCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export type UnderlyingSeries = {
  symbol: string
  timeframe: 'H1' | 'D1'
  candles: UnderlyingCandle[]
  daily: UnderlyingDailyReturn[]
}

export type DailyPoint = {
  time: number
  value: number
}

export type DailySeries = {
  sleeve: SleeveKey
  points: DailyPoint[]
}

export type PortfolioDay = {
  time: number
  pnl: number
  equity: number
  denom: number
  return: number
}

export type ContributionSeries = {
  key: string
  sleeve: SleeveKey
  symbol: string
  pnl: DailyPoint[]
  returns: DailyPoint[]
  index: DailyPoint[]
  drawdown: DailyPoint[]
  drawdownSource?: 'H1' | 'D1'
  drawdownMtm?: DailyPoint[]
  drawdownMtmSource?: 'H1' | 'D1'
  baseCapital?: number
}

export type ReportModel = {
  generatedAt: number
  dealsSourceName?: string
  portfolio: {
    days: PortfolioDay[]
    index: DailyPoint[]
    drawdown: DailyPoint[]
    drawdownSource?: 'H1' | 'D1'
    drawdownMtm?: DailyPoint[]
    drawdownMtmSource?: 'H1' | 'D1'
  }
  contributions: ContributionSeries[]
}
