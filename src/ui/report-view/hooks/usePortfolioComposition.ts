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

export const usePortfolioComposition = (sleeveLabels: string[]) => {
  const [enabledSleeves, setEnabledSleeves] = useState<Set<string>>(() => new Set(sleeveLabels))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sleeveWeights, setSleeveWeights] = useState<Record<string, number>>(() =>
    buildDefaultWeights(sleeveLabels),
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
      setEnabledSleeves(new Set(nextSleeves))
      setSleeveWeights({ ...nextWeights })
    },
    [],
  )

  const resetToBaseline = useCallback(() => {
    setEnabledSleeves(new Set(sleeveLabels))
    setSleeveWeights(buildDefaultWeights(sleeveLabels))
  }, [sleeveLabels])

  return {
    enabledSleeves,
    sleeveWeights,
    enabledCount: enabledSleeves.size,
    totalSleeves: sleeveLabels.length,
    isFiltered: enabledSleeves.size !== sleeveLabels.length,
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
