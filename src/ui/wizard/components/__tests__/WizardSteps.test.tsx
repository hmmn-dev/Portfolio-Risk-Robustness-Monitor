// @vitest-environment jsdom

import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../../../test/render'
import FileUploadField from '../FileUploadField'
import GenerationStep from '../GenerationStep'
import UnderlyingUploadStep from '../UnderlyingUploadStep'

describe('FileUploadField', () => {
  it('forwards selected and dropped files and exposes a named removal action', async () => {
    const user = userEvent.setup()
    const onFilesSelected = vi.fn()
    const onRemove = vi.fn()
    const currentFile = new File(['current'], 'deals.csv', { type: 'text/csv' })
    const replacement = new File(['new'], 'replacement.csv', { type: 'text/csv' })
    const dropped = new File(['drop'], 'dropped.csv', { type: 'text/csv' })

    renderWithTheme(
      <FileUploadField
        title="Deals CSV"
        file={currentFile}
        emptyText="Select a file"
        selectLabel="Replace"
        disabled={false}
        onFilesSelected={onFilesSelected}
        onRemove={onRemove}
        removeLabel="Remove deals file"
      />,
    )

    await user.upload(screen.getByLabelText('Deals CSV file input'), replacement)
    fireEvent.drop(screen.getByText('deals.csv').closest('label') as HTMLLabelElement, {
      dataTransfer: { files: [dropped] },
    })
    await user.click(screen.getByRole('button', { name: 'Remove deals file' }))

    expect(onFilesSelected).toHaveBeenNthCalledWith(1, [replacement])
    expect(onFilesSelected).toHaveBeenNthCalledWith(2, [dropped])
    expect(onRemove).toHaveBeenCalledOnce()
  })
})

describe('UnderlyingUploadStep', () => {
  it('renders symbol uploads and forwards mode, selection, and removal commands', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    const onFileSelected = vi.fn()
    const onFileRemoved = vi.fn()
    const file = new File(['prices'], 'EURUSD_D1.csv', { type: 'text/csv' })

    renderWithTheme(
      <UnderlyingUploadStep
        mode="perSymbol"
        symbols={['EURUSD']}
        files={{ EURUSD: file }}
        missingSymbols={[]}
        disabled={false}
        onModeChange={onModeChange}
        onFileSelected={onFileSelected}
        onFileRemoved={onFileRemoved}
        onBulkFilesSelected={vi.fn()}
      />,
    )

    await user.upload(screen.getByLabelText('EURUSD file input'), file)
    await user.click(screen.getByRole('button', { name: 'Remove EURUSD file' }))
    await user.click(screen.getByRole('radio', { name: 'Bulk upload' }))

    expect(onFileSelected).toHaveBeenCalledWith('EURUSD', file)
    expect(onFileRemoved).toHaveBeenCalledWith('EURUSD')
    expect(onModeChange).toHaveBeenCalledWith('bulk')
  })

  it('shows missing symbols and uploaded bulk files', () => {
    const file = new File(['prices'], 'EURUSD_D1.csv', { type: 'text/csv' })

    renderWithTheme(
      <UnderlyingUploadStep
        mode="bulk"
        symbols={['EURUSD', 'USDJPY']}
        files={{ EURUSD: file }}
        missingSymbols={['USDJPY']}
        disabled={false}
        onModeChange={vi.fn()}
        onFileSelected={vi.fn()}
        onFileRemoved={vi.fn()}
        onBulkFilesSelected={vi.fn()}
      />,
    )

    expect(screen.getByText('Uploaded files')).toBeInTheDocument()
    expect(screen.getByText('EURUSD_D1.csv')).toBeInTheDocument()
    expect(
      screen.getByText('Missing candle files for: USDJPY. Upload them to continue.'),
    ).toBeVisible()
  })
})

describe('GenerationStep', () => {
  it('distinguishes a ready workflow from unresolved issues', () => {
    const { rerender } = renderWithTheme(<GenerationStep issues={[]} />)

    expect(screen.getByText('All checks passed.')).toBeInTheDocument()

    rerender(<GenerationStep issues={['Deals are not parsed yet.']} />)

    expect(screen.getByText('Deals are not parsed yet.')).toBeInTheDocument()
    expect(screen.queryByText('All checks passed.')).not.toBeInTheDocument()
  })
})
