// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../../../test/render'
import MarDegradationDialog from '../MarDegradationDialog'
import PdfSettingsDialog from '../PdfSettingsDialog'
import ReportHeader from '../ReportHeader'

describe('ReportHeader', () => {
  it('forwards navigation and report actions through its public callbacks', async () => {
    const user = userEvent.setup()
    const onTabChange = vi.fn()
    const onOpenPdf = vi.fn()
    const onRegenerate = vi.fn()
    const onOpenMarDegradation = vi.fn()

    renderWithTheme(
      <ReportHeader
        tab="performance"
        reportMeta="Deals: deals.csv"
        marDegradationPct={null}
        isPdfGenerating={false}
        isMarApplying={false}
        canApplyMarDegradation
        onTabChange={onTabChange}
        onOpenPdf={onOpenPdf}
        onRegenerate={onRegenerate}
        onOpenMarDegradation={onOpenMarDegradation}
        onRemoveMarDegradation={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Risk / Decay' }))
    await user.click(screen.getByRole('tab', { name: 'Strategies' }))
    await user.click(screen.getByRole('button', { name: 'Generate PDF report' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate report' }))
    await user.click(screen.getByRole('button', { name: 'Report actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Apply MAR degradation' }))

    expect(onTabChange).toHaveBeenCalledWith('risk')
    expect(onTabChange).toHaveBeenCalledWith('sleeves')
    expect(onOpenPdf).toHaveBeenCalledOnce()
    expect(onRegenerate).toHaveBeenCalledOnce()
    expect(onOpenMarDegradation).toHaveBeenCalledOnce()
  })

  it('shows an applied degradation and supports removing it', async () => {
    const user = userEvent.setup()
    const onRemoveMarDegradation = vi.fn()

    renderWithTheme(
      <ReportHeader
        tab="performance"
        reportMeta="Deals: deals.csv"
        marDegradationPct={15}
        isPdfGenerating={false}
        isMarApplying={false}
        canApplyMarDegradation
        onTabChange={vi.fn()}
        onOpenPdf={vi.fn()}
        onRegenerate={vi.fn()}
        onOpenMarDegradation={vi.fn()}
        onRemoveMarDegradation={onRemoveMarDegradation}
      />,
    )

    expect(screen.getByText('MAR Degradation -15%')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Remove MAR degradation'))

    expect(onRemoveMarDegradation).toHaveBeenCalledOnce()
  })
})

describe('PdfSettingsDialog', () => {
  it('exposes PDF settings and generation commands', async () => {
    const user = userEvent.setup()
    const onNameChange = vi.fn()
    const onOrientationChange = vi.fn()
    const onObfuscateChange = vi.fn()
    const onGenerate = vi.fn()

    renderWithTheme(
      <PdfSettingsDialog
        open
        name="Portfolio"
        orientation="portrait"
        obfuscate
        onClose={vi.fn()}
        onNameChange={onNameChange}
        onOrientationChange={onOrientationChange}
        onObfuscateChange={onObfuscateChange}
        onGenerate={onGenerate}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Portfolio name' }), ' 2026')
    await user.click(screen.getByRole('combobox', { name: 'Orientation' }))
    await user.click(screen.getByRole('option', { name: 'Landscape' }))
    await user.click(screen.getByRole('switch', { name: 'Obfuscate strategy and symbol names' }))
    await user.click(screen.getByRole('button', { name: 'Generate PDF' }))

    expect(onNameChange).toHaveBeenCalled()
    expect(onOrientationChange).toHaveBeenCalledWith('landscape')
    expect(onObfuscateChange).toHaveBeenCalledWith(false)
    expect(onGenerate).toHaveBeenCalledOnce()
  })
})

describe('MarDegradationDialog', () => {
  it('forwards percentage changes and applies an enabled request', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const onApply = vi.fn()

    renderWithTheme(
      <MarDegradationDialog
        open
        value="10"
        canApply
        isApplying={false}
        onClose={vi.fn()}
        onValueChange={onValueChange}
        onApply={onApply}
      />,
    )

    await user.type(screen.getByRole('spinbutton', { name: 'Degrade MAR by (%)' }), '5')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onValueChange).toHaveBeenCalled()
    expect(onApply).toHaveBeenCalledOnce()
  })

  it('prevents applying when source deals are unavailable', () => {
    renderWithTheme(
      <MarDegradationDialog
        open
        value="10"
        canApply={false}
        isApplying={false}
        onClose={vi.fn()}
        onValueChange={vi.fn()}
        onApply={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  })
})
