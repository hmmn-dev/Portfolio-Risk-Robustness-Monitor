import type { DailyPoint } from './types'

export type ShockFlag = 'NONE' | 'ORANGE' | 'RED'

type DdShockResult = {
  flag: ShockFlag
  lastWindowMagnitude: number
  previousMaxMagnitude: number
}

const magnitudeFromDrawdown = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return 0
  const min = Math.min(...finite)
  return Math.abs(min)
}

export const computeDdShock = (
  drawdown: DailyPoint[],
  window = 63,
  orangeRatio = 1.5,
  redRatio = 2.0,
  minShock = 5
): DdShockResult => {
  if (drawdown.length === 0) {
    return { flag: 'NONE', lastWindowMagnitude: 0, previousMaxMagnitude: 0 }
  }

  const values = drawdown.map((point) => point.value)
  const lastWindow = values.slice(-window)
  const previousWindow = values.slice(0, Math.max(0, values.length - window))
  const lastMagnitude = magnitudeFromDrawdown(lastWindow)
  const previousMax = magnitudeFromDrawdown(previousWindow)

  if (!Number.isFinite(previousMax) || previousMax <= 0) {
    if (lastMagnitude >= minShock) {
      return {
        flag: 'ORANGE',
        lastWindowMagnitude: lastMagnitude,
        previousMaxMagnitude: previousMax,
      }
    }
    return { flag: 'NONE', lastWindowMagnitude: lastMagnitude, previousMaxMagnitude: previousMax }
  }

  const ratio = lastMagnitude / previousMax
  if (ratio >= redRatio) {
    return { flag: 'RED', lastWindowMagnitude: lastMagnitude, previousMaxMagnitude: previousMax }
  }
  if (ratio >= orangeRatio) {
    return { flag: 'ORANGE', lastWindowMagnitude: lastMagnitude, previousMaxMagnitude: previousMax }
  }

  return { flag: 'NONE', lastWindowMagnitude: lastMagnitude, previousMaxMagnitude: previousMax }
}
