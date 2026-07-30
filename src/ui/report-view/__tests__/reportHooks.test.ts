import { describe, expect, it } from 'vitest'
import { clampMarDegradation } from '../hooks/useMarDegradation'
import { sanitizePdfName } from '../hooks/usePdfExport'

describe('report workflow helpers', () => {
  it('sanitizes PDF names while keeping a useful fallback', () => {
    expect(sanitizePdfName('  Portfolio: Risk / July  ')).toBe('Portfolio- Risk - July')
    expect(sanitizePdfName('   ')).toBe('Portfolio report')
  })

  it('clamps MAR degradation to the supported percentage range', () => {
    expect(clampMarDegradation(-5)).toBe(0)
    expect(clampMarDegradation(25)).toBe(25)
    expect(clampMarDegradation(120)).toBe(100)
  })
})
