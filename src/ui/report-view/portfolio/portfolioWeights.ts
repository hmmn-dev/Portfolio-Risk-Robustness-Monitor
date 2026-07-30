import { stableSort } from '../../../engine/stableSort'

export const WEIGHT_EPSILON = 1e-6

export const buildDefaultWeights = (labels: string[]) =>
  Object.fromEntries(labels.map((label) => [label, 1]))

export const buildWeightDraft = (labels: string[], weights: Record<string, number>) =>
  Object.fromEntries(labels.map((label) => [label, (weights[label] ?? 1).toFixed(2)]))

export const isWeightInputValue = (value: string) => /^\d*(\.\d{0,2})?$/.test(value)

export const areSortedSleevesEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const sortSleeves = (values: Iterable<string>) =>
  stableSort(Array.from(values), (a, b) => a.localeCompare(b))

export const resolveGlobalWeightDraft = (draft: Record<string, string>, labels: string[]) => {
  if (labels.length === 0) return ''
  const first = draft[labels[0]] ?? ''
  return labels.every((label) => (draft[label] ?? '') === first) ? first : ''
}

export const countModifiedWeights = (labels: string[], weights: Record<string, number>) =>
  labels.filter((label) => {
    const weight = weights[label] ?? 1
    return Number.isFinite(weight) && Math.abs(weight - 1) > WEIGHT_EPSILON
  }).length

export const isWeightDraftValid = (labels: string[], draft: Record<string, string>) =>
  labels.every((label) => {
    const value = draft[label]
    return value != null && value !== '' && Number.isFinite(Number(value))
  })

export const hasModifiedWeightDraft = (labels: string[], draft: Record<string, string>) =>
  labels.some((label) => {
    const weight = Number(draft[label])
    return Number.isFinite(weight) && Math.abs(weight - 1) > WEIGHT_EPSILON
  })

export const normalizeWeightDraft = (labels: string[], draft: Record<string, string>) =>
  Object.fromEntries(
    labels.map((label) => {
      const parsed = Number(draft[label])
      return [label, Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 1]
    }),
  )
