// @vitest-environment jsdom

import { createTheme } from '@mui/material/styles'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import MonthlyReturnsTable from '../portfolio/MonthlyReturnsTable'
import PortfolioChartsPanel from '../portfolio/PortfolioChartsPanel'
import PortfolioCompositionDialog from '../portfolio/PortfolioCompositionDialog'
import PortfolioCorrelationPanel from '../portfolio/PortfolioCorrelationPanel'
import PortfolioSummaryPanel from '../portfolio/PortfolioSummaryPanel'
import PortfolioToolbar from '../portfolio/PortfolioToolbar'

vi.mock('../../charts', () => ({
  EquityChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="portfolio-equity-chart">{data.length}</div>
  ),
  DrawdownChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="portfolio-drawdown-chart">{data.length}</div>
  ),
}))

describe('portfolio presentation components', () => {
  it('forwards toolbar commands and exposes the modified portfolio state', async () => {
    const user = userEvent.setup()
    const onOpenComposition = vi.fn()
    const onPnlScaleModeChange = vi.fn()

    renderWithTheme(
      <PortfolioToolbar
        enabledCount={1}
        totalSleeves={2}
        modifiedWeightCount={1}
        portfolioModified
        hasMtmDrawdown
        drawdownMode="deal"
        pnlScaleMode="linear"
        onOpenComposition={onOpenComposition}
        onDrawdownModeChange={vi.fn()}
        onPnlScaleModeChange={onPnlScaleModeChange}
      />,
    )

    expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    expect(screen.getByText('custom weights (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In-Trade' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    await user.click(screen.getByRole('button', { name: 'Log' }))

    expect(onOpenComposition).toHaveBeenCalledOnce()
    expect(onPnlScaleModeChange).toHaveBeenCalledWith('log')
  })

  it('keeps the composition dialog driven by values and callbacks', async () => {
    const user = userEvent.setup()
    const onToggleSleeve = vi.fn()
    const onUpdateWeight = vi.fn()
    const onUpdateGlobalWeight = vi.fn()
    const onApply = vi.fn()
    const onResetToBaseline = vi.fn()

    renderWithTheme(
      <PortfolioCompositionDialog
        open
        labels={['Alpha', 'Beta']}
        sleeveDraft={new Set(['Alpha'])}
        weightDraft={{ Alpha: '1.00', Beta: '0.50' }}
        globalWeightDraft=""
        modified
        applyDisabled={false}
        onClose={vi.fn()}
        onToggleSleeve={onToggleSleeve}
        onSelectAll={vi.fn()}
        onClear={vi.fn()}
        onUpdateWeight={onUpdateWeight}
        onUpdateGlobalWeight={onUpdateGlobalWeight}
        onApplyGlobalWeight={vi.fn()}
        onResetWeights={vi.fn()}
        onResetToBaseline={onResetToBaseline}
        onApply={onApply}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }))
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Weight' })[1], {
      target: { value: '0.75' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'All sleeves weight' }), {
      target: { value: '0.80' },
    })
    await user.click(screen.getByRole('button', { name: 'Reset to baseline' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(dialog).toBeInTheDocument()
    expect(onToggleSleeve).toHaveBeenCalledWith('Beta')
    expect(onUpdateWeight).toHaveBeenCalledWith('Beta', '0.75')
    expect(onUpdateGlobalWeight).toHaveBeenCalledWith('0.80')
    expect(onResetToBaseline).toHaveBeenCalledOnce()
    expect(onApply).toHaveBeenCalledOnce()
  })

  it('renders calculated portfolio panels and forwards correlation controls', async () => {
    const user = userEvent.setup()
    const context = createReportContext()
    const onShowNumbersChange = vi.fn()
    const theme = createTheme()
    const drawdown = [{ time: Date.UTC(2024, 0, 1), value: -4 }]

    renderWithTheme(
      <>
        <PortfolioChartsPanel
          index={[{ time: Date.UTC(2024, 0, 1), value: 1 }]}
          drawdown={drawdown}
          drawdownSource="D1"
          pnlScaleMode="linear"
          baseCapital={10000}
          pnlColor="#1976d2"
          axisColor="#555555"
          gridColor="#dddddd"
        />
        <MonthlyReturnsTable
          rows={[
            {
              year: 2024,
              months: [0.1, ...Array(11).fill(null)],
              total: 0.1,
              maxDrawdown: -4,
            },
          ]}
          theme={theme}
        />
        <PortfolioCorrelationPanel
          matrix={context.portfolio.correlationMatrix}
          legend={context.portfolio.correlationLegend}
          cellSize={28}
          showNumbers
          theme={theme}
          onShowNumbersChange={onShowNumbersChange}
        />
        <PortfolioSummaryPanel
          summary={context.portfolio.portfolioSummary}
          drawdown={drawdown}
          drawdownMode="deal"
          drawdownSource="D1"
          riskRows={context.portfolio.riskRows}
          customPortfolio
          formatSymbol={(symbol) => `TEST-${symbol}`}
        />
      </>,
    )

    expect(screen.getByTestId('portfolio-equity-chart')).toHaveTextContent('1')
    expect(screen.getByTestId('portfolio-drawdown-chart')).toHaveTextContent('1')
    expect(screen.getAllByText('10.00%')).toHaveLength(2)
    expect(screen.getByText(/TEST-EURUSD: 0.70/)).toBeInTheDocument()
    expect(
      screen.getByText(/Results are based on the selected sleeve series and weights/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Show values' }))
    expect(onShowNumbersChange).toHaveBeenCalledWith(false)
  })
})
