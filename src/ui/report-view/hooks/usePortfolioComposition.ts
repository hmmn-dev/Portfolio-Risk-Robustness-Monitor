import { useCallback, useMemo, useState } from 'react'
import type { ReportModel } from '../../../engine/types'
import {
  areSortedSleevesEqual,
  buildDefaultWeights,
  countModifiedWeights,
  sortSleeves,
} from '../portfolio/portfolioWeights'

export const getPortfolioSleeveLabels = (report: ReportModel) =>
  sortSleeves(new Set(report.contributions.map((item) => item.sleeve)))

export type AppliedPortfolioComposition = {
  sleeveLabels: string[]
  enabledSleeves: Set<string>
  sleeveWeights: Record<string, number>
}

type PortfolioCompositionOwner = {
  appliedComposition: AppliedPortfolioComposition | null
  onApplyComposition: (composition: AppliedPortfolioComposition) => void
  onResetComposition: () => void
}

export const usePortfolioComposition = (
  sleeveLabels: string[],
  { appliedComposition, onApplyComposition, onResetComposition }: PortfolioCompositionOwner,
) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const currentComposition =
    appliedComposition && areSortedSleevesEqual(appliedComposition.sleeveLabels, sleeveLabels)
      ? appliedComposition
      : null
  const enabledSleeves = useMemo(
    () => currentComposition?.enabledSleeves ?? new Set(sleeveLabels),
    [currentComposition, sleeveLabels],
  )
  const sleeveWeights = useMemo(
    () => currentComposition?.sleeveWeights ?? buildDefaultWeights(sleeveLabels),
    [currentComposition, sleeveLabels],
  )

  const sortedEnabledSleeves = useMemo(() => sortSleeves(enabledSleeves), [enabledSleeves])
  const compositionChanged = !areSortedSleevesEqual(sortedEnabledSleeves, sleeveLabels)
  const modifiedWeightCount = useMemo(
    () => countModifiedWeights(sleeveLabels, sleeveWeights),
    [sleeveLabels, sleeveWeights],
  )
  const weightsChanged = modifiedWeightCount > 0
  const openDialog = useCallback(() => setDialogOpen(true), [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])

  const apply = useCallback(
    (nextSleeves: ReadonlySet<string>, nextWeights: Record<string, number>) => {
      if (nextSleeves.size === 0) return
      onApplyComposition({
        sleeveLabels: [...sleeveLabels],
        enabledSleeves: new Set(nextSleeves),
        sleeveWeights: Object.fromEntries(
          sleeveLabels.map((label) => [label, nextWeights[label] ?? 1]),
        ),
      })
    },
    [onApplyComposition, sleeveLabels],
  )

  const resetToBaseline = useCallback(() => onResetComposition(), [onResetComposition])

  return {
    enabledSleeves,
    sleeveWeights,
    enabledCount: enabledSleeves.size,
    totalSleeves: sleeveLabels.length,
    isFiltered: compositionChanged,
    hasCustomWeights: weightsChanged,
    isModified: compositionChanged || weightsChanged,
    modifiedWeightCount,
    dialog: {
      open: dialogOpen,
      openDialog,
      close: closeDialog,
      resetToBaseline,
      apply,
    },
  }
}
