export const correlation = (seriesA: number[], seriesB: number[]): number | null => {
  if (seriesA.length === 0 || seriesA.length !== seriesB.length) return null
  const meanA = seriesA.reduce((acc, value) => acc + value, 0) / seriesA.length
  const meanB = seriesB.reduce((acc, value) => acc + value, 0) / seriesB.length

  let numerator = 0
  let denomA = 0
  let denomB = 0

  for (let i = 0; i < seriesA.length; i += 1) {
    const diffA = seriesA[i] - meanA
    const diffB = seriesB[i] - meanB
    numerator += diffA * diffB
    denomA += diffA * diffA
    denomB += diffB * diffB
  }

  const denominator = Math.sqrt(denomA * denomB)
  return denominator === 0 ? null : numerator / denominator
}
