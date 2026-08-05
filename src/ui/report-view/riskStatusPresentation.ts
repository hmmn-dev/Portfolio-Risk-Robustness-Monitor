import type { RiskRow } from './types'

export const getStatusLabel = (status: RiskRow['status']) =>
  status === 'UNKNOWN' ? 'INSUFFICIENT' : status

const formatEvidenceDate = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return 'none'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'none' : date.toISOString().slice(0, 10)
}

export const formatAlphaEvidence = (row: RiskRow) => {
  const evidence = row.alphaEvidence
  const source = evidence.source === 'UNDERLYING' ? 'underlying' : 'portfolio proxy'
  if (evidence.state === 'CURRENT') {
    return `${evidence.activeObservations} active · ${source}`
  }
  if (evidence.alignedObservations < evidence.requiredAlignedObservations) {
    return `${evidence.alignedObservations}/${evidence.requiredAlignedObservations} aligned · ${source}`
  }
  if (evidence.activeObservations < evidence.requiredActiveObservations) {
    return `${evidence.activeObservations}/${evidence.requiredActiveObservations} active · ${source}`
  }
  if (evidence.historyObservations < evidence.requiredHistoryObservations) {
    return `${evidence.historyObservations}/${evidence.requiredHistoryObservations} history · ${source}`
  }
  return `last valid ${formatEvidenceDate(evidence.lastValidTime)} · ${source}`
}

export const formatAlphaEvidenceDate = (row: RiskRow) =>
  row.alphaEvidence.state === 'CURRENT'
    ? formatEvidenceDate(row.alphaEvidence.reportTime)
    : formatEvidenceDate(row.alphaEvidence.lastValidTime)
