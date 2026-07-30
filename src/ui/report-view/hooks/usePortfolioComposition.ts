import { useCallback, useMemo, useState } from 'react'
import type { ReportModel } from '../../../engine/types'
import {
  areSortedSleevesEqual,
  buildDefaultWeights,
  buildWeightDraft,
  countModifiedWeights,
  hasModifiedWeightDraft,
  isWeightDraftValid,
  isWeightInputValue,
  normalizeWeightDraft,
  resolveGlobalWeightDraft,
  sortSleeves,
} from '../portfolio/portfolioWeights'

export const getPortfolioSleeveLabels = (report: ReportModel) =>
  sortSleeves(new Set(report.contributions.map((item) => item.sleeve)))

export const usePortfolioComposition = (sleeveLabels: string[]) => {
  const [enabledSleeves, setEnabledSleeves] = useState<Set<string>>(() => new Set(sleeveLabels))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sleeveDraft, setSleeveDraft] = useState<Set<string>>(() => new Set(sleeveLabels))
  const [sleeveWeights, setSleeveWeights] = useState<Record<string, number>>(() =>
    buildDefaultWeights(sleeveLabels),
  )
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>(() =>
    buildWeightDraft(sleeveLabels, buildDefaultWeights(sleeveLabels)),
  )
  const [globalWeightDraft, setGlobalWeightDraft] = useState('1.00')

  const sortedEnabledSleeves = useMemo(() => sortSleeves(enabledSleeves), [enabledSleeves])
  const compositionChanged = !areSortedSleevesEqual(sortedEnabledSleeves, sleeveLabels)
  const modifiedWeightCount = useMemo(
    () => countModifiedWeights(sleeveLabels, sleeveWeights),
    [sleeveLabels, sleeveWeights],
  )
  const weightsChanged = modifiedWeightCount > 0
  const draftCompositionChanged = !areSortedSleevesEqual(sortSleeves(sleeveDraft), sleeveLabels)
  const draftWeightsChanged = hasModifiedWeightDraft(sleeveLabels, weightDraft)

  const openDialog = useCallback(() => {
    setSleeveDraft(new Set(enabledSleeves))
    const nextDraft = buildWeightDraft(sleeveLabels, sleeveWeights)
    setWeightDraft(nextDraft)
    setGlobalWeightDraft(resolveGlobalWeightDraft(nextDraft, sleeveLabels))
    setDialogOpen(true)
  }, [enabledSleeves, sleeveLabels, sleeveWeights])

  const toggleDraftSleeve = useCallback((label: string) => {
    setSleeveDraft((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const updateWeightDraft = useCallback(
    (label: string, value: string) => {
      if (!isWeightInputValue(value)) return
      const next = { ...weightDraft, [label]: value }
      setWeightDraft(next)
      setGlobalWeightDraft(resolveGlobalWeightDraft(next, sleeveLabels))
    },
    [sleeveLabels, weightDraft],
  )

  const updateGlobalWeightDraft = useCallback((value: string) => {
    if (isWeightInputValue(value)) setGlobalWeightDraft(value)
  }, [])

  const applyGlobalWeightDraft = useCallback(() => {
    if (globalWeightDraft === '') return
    setWeightDraft(Object.fromEntries(sleeveLabels.map((label) => [label, globalWeightDraft])))
  }, [globalWeightDraft, sleeveLabels])

  const resetWeightDraft = useCallback(() => {
    const next = buildWeightDraft(sleeveLabels, buildDefaultWeights(sleeveLabels))
    setWeightDraft(next)
    setGlobalWeightDraft('1.00')
  }, [sleeveLabels])

  const resetToBaseline = useCallback(() => {
    const nextWeights = buildDefaultWeights(sleeveLabels)
    setEnabledSleeves(new Set(sleeveLabels))
    setSleeveDraft(new Set(sleeveLabels))
    setSleeveWeights(nextWeights)
    setWeightDraft(buildWeightDraft(sleeveLabels, nextWeights))
    setGlobalWeightDraft('1.00')
  }, [sleeveLabels])

  const apply = useCallback(() => {
    if (sleeveDraft.size === 0 || !isWeightDraftValid(sleeveLabels, weightDraft)) {
      return
    }
    setEnabledSleeves(new Set(sleeveDraft))
    setSleeveWeights(normalizeWeightDraft(sleeveLabels, weightDraft))
    setDialogOpen(false)
  }, [sleeveDraft, sleeveLabels, weightDraft])

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
      sleeveDraft,
      weightDraft,
      globalWeightDraft,
      isModified:
        compositionChanged || weightsChanged || draftCompositionChanged || draftWeightsChanged,
      applyDisabled: sleeveDraft.size === 0 || !isWeightDraftValid(sleeveLabels, weightDraft),
      openDialog,
      close: () => setDialogOpen(false),
      toggleSleeve: toggleDraftSleeve,
      selectAll: () => setSleeveDraft(new Set(sleeveLabels)),
      clear: () => setSleeveDraft(new Set()),
      updateWeight: updateWeightDraft,
      updateGlobalWeight: updateGlobalWeightDraft,
      applyGlobalWeight: applyGlobalWeightDraft,
      resetWeights: resetWeightDraft,
      resetToBaseline,
      apply,
    },
  }
}
