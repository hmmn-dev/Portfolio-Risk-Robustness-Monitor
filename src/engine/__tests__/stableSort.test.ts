import { describe, expect, it } from 'vitest'
import { stableSort } from '../stableSort'

describe('stableSort', () => {
  it('preserves input order for ties', () => {
    const input = [
      { id: 'b', group: 1 },
      { id: 'a', group: 1 },
      { id: 'c', group: 1 },
    ]

    const sorted = stableSort(input, (a, b) => a.group - b.group)

    expect(sorted.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts deterministically with secondary keys', () => {
    const input = [
      { id: 'b', value: 2 },
      { id: 'a', value: 2 },
      { id: 'c', value: 1 },
    ]

    const sorted = stableSort(input, (a, b) => a.value - b.value || a.id.localeCompare(b.id))

    expect(sorted.map((item) => item.id)).toEqual(['c', 'a', 'b'])
  })
})
