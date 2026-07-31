// @vitest-environment jsdom

import { createTheme } from '@mui/material/styles'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import { calculateCorrelationCellSize } from '../../helpers/correlationLayout'
import MonthlyReturnsTable from '../portfolio/MonthlyReturnsTable'
import PortfolioAnalyticsFrame from '../portfolio/PortfolioAnalyticsFrame'
import PortfolioChartsPanel from '../portfolio/PortfolioChartsPanel'
import PortfolioCompositionDialog from '../portfolio/PortfolioCompositionDialog'
import PortfolioCorrelationPanel from '../portfolio/PortfolioCorrelationPanel'
import PortfolioSummaryPanel from '../portfolio/PortfolioSummaryPanel'
import PortfolioToolbar from '../portfolio/PortfolioToolbar'
import PortfolioRegressionSummary from '../portfolio/summary/PortfolioRegressionSummary'

vi.mock('../../charts', () => ({
  EquityChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="portfolio-equity-chart">{data.length}</div>
  ),
  DrawdownChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="portfolio-drawdown-chart">{data.length}</div>
  ),
}))

describe('portfolio presentation components', () => {
  it('marks the complete portfolio surface as refreshing while retaining its content', () => {
    renderWithTheme(
      <PortfolioAnalyticsFrame refreshing>
        <div>Current portfolio chart</div>
        <div>Current portfolio summary</div>
      </PortfolioAnalyticsFrame>,
    )

    const analytics = screen.getByRole('region', { name: 'Portfolio analytics' })
    expect(analytics).toHaveAttribute('aria-busy', 'true')
    expect(within(analytics).getByRole('status')).toHaveTextContent('Refreshing portfolio view')
    expect(within(analytics).getByText('Updating charts and analytics sections')).toBeVisible()
    expect(within(analytics).getByText('Current portfolio chart')).toBeVisible()
    expect(within(analytics).getByText('Current portfolio summary')).toBeVisible()
  })

  it('scales correlation cells from double area toward the baseline as portfolios grow', () => {
    const resolveSize = (portfolioSize: number) =>
      calculateCorrelationCellSize({
        baseCellSize: 28,
        portfolioSize,
        containerWidth: 1200,
        sideBySide: true,
      })

    expect(resolveSize(8)).toBe(40)
    expect(resolveSize(24)).toBe(33)
    expect(resolveSize(40)).toBe(28)
  })

  it('forwards toolbar commands and exposes the modified portfolio state', async () => {
    const user = userEvent.setup()
    const onOpenComposition = vi.fn()
    const onDrawdownModeChange = vi.fn()
    const onPnlScaleModeChange = vi.fn()

    renderWithTheme(
      <PortfolioToolbar
        enabledCount={1}
        totalSleeves={2}
        modifiedWeightCount={1}
        hasMtmDrawdown
        drawdownMode="deal"
        pnlScaleMode="linear"
        onOpenComposition={onOpenComposition}
        onDrawdownModeChange={onDrawdownModeChange}
        onPnlScaleModeChange={onPnlScaleModeChange}
      />,
    )

    expect(screen.getByText('1 out of 2 sleeves selected')).toBeInTheDocument()
    expect(screen.getByText('custom weights (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In-Trade' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Change portfolio composition' }))
    await user.click(screen.getByRole('button', { name: 'In-Trade' }))
    await user.click(screen.getByRole('button', { name: 'Log' }))

    expect(onOpenComposition).toHaveBeenCalledOnce()
    expect(onDrawdownModeChange).toHaveBeenCalledWith('mtm')
    expect(onPnlScaleModeChange).toHaveBeenCalledWith('log')
  })

  it('keeps composition edits local and emits a normalized draft on apply', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onResetToBaseline = vi.fn()

    renderWithTheme(
      <PortfolioCompositionDialog
        labels={['Alpha', 'Beta']}
        enabledSleeves={new Set(['Alpha'])}
        sleeveWeights={{ Alpha: 1, Beta: 0.5 }}
        modified
        onClose={vi.fn()}
        onResetToBaseline={onResetToBaseline}
        onApply={onApply}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Change portfolio composition' })
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'All sleeves weight' }), {
      target: { value: '0.80' },
    })
    await user.click(screen.getByRole('button', { name: 'Apply to all' }))
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Weight' })[1], {
      target: { value: '0.75' },
    })
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(dialog).toBeInTheDocument()
    const [enabledSleeves, sleeveWeights] = onApply.mock.calls[0] as [
      ReadonlySet<string>,
      Record<string, number>,
    ]
    expect(Array.from(enabledSleeves)).toEqual(['Alpha', 'Beta'])
    expect(sleeveWeights).toEqual({ Alpha: 0.8, Beta: 0.75 })

    await user.click(screen.getByRole('button', { name: 'Reset to baseline' }))
    expect(onResetToBaseline).toHaveBeenCalledOnce()
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).toBeChecked())
    expect(screen.getAllByRole('textbox', { name: 'Weight' })[0]).toHaveValue('1.00')
    expect(screen.getAllByRole('textbox', { name: 'Weight' })[1]).toHaveValue('1.00')
  })

  it('filters portfolio equity and drawdown with the same date-range preset', async () => {
    const user = userEvent.setup()
    const points = [2018, 2024, 2026].map((year) => ({
      time: Date.UTC(year, 0, 1),
      value: 1,
    }))

    renderWithTheme(
      <PortfolioChartsPanel
        index={points}
        drawdown={points}
        drawdownSource="D1"
        pnlScaleMode="linear"
        baseCapital={10000}
        pnlColor="#1976d2"
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    const startDate = screen.getByLabelText('Portfolio equity date range start date')
    const startDateValue = screen.getByLabelText('Portfolio equity date range start date value')
    const presetGroup = screen.getByRole('group', { name: 'Portfolio equity date range' })
    expect(
      startDate.compareDocumentPosition(presetGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByTestId('portfolio-equity-chart')).toHaveTextContent('3')
    expect(screen.getByTestId('portfolio-drawdown-chart')).toHaveTextContent('3')

    await user.click(screen.getByRole('button', { name: '1Y' }))

    expect(screen.getByTestId('portfolio-equity-chart')).toHaveTextContent('1')
    expect(screen.getByTestId('portfolio-drawdown-chart')).toHaveTextContent('1')

    const endDateValue = screen.getByLabelText('Portfolio equity date range end date value')
    expect(startDateValue).toHaveValue('01 Jan 2025')
    expect(endDateValue).toHaveValue('01 Jan 2026')

    fireEvent.change(startDateValue, { target: { value: '01 Jan 2024' } })

    expect(screen.getByTestId('portfolio-equity-chart')).toHaveTextContent('2')
    expect(screen.getByTestId('portfolio-drawdown-chart')).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens the Material calendar from a date field', async () => {
    const user = userEvent.setup()
    const points = [1, 2, 3].map((day) => ({
      time: Date.UTC(2024, 0, day),
      value: 1,
    }))

    renderWithTheme(
      <PortfolioChartsPanel
        index={points}
        drawdown={points}
        drawdownSource="D1"
        pnlScaleMode="linear"
        baseCapital={10000}
        pnlColor="#1976d2"
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /choose date/i })[0])

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('keeps correlation strategy labels on one line and reveals truncated names', async () => {
    const user = userEvent.setup()
    const label = 'Daily Volatility Breakout - GBPJPY'

    renderWithTheme(
      <PortfolioCorrelationPanel
        matrix={{ labels: [label], values: [[1]] }}
        legend="linear-gradient(red, green)"
        cellSize={28}
        showNumbers={false}
        theme={createTheme()}
        onShowNumbersChange={vi.fn()}
      />,
    )

    const renderedLabel = screen.getByText(`1. ${label}`)
    Object.defineProperties(renderedLabel, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 320 },
    })
    fireEvent.resize(window)

    expect(renderedLabel).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    })
    await user.hover(renderedLabel)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(`1. ${label}`)
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
          index={[
            { time: Date.UTC(2024, 0, 1), value: 1 },
            { time: Date.UTC(2024, 0, 2), value: 1.1 },
          ]}
          returns={[
            { time: Date.UTC(2024, 0, 1), value: 0.1 },
            { time: Date.UTC(2024, 0, 2), value: -0.05 },
          ]}
          drawdown={drawdown}
          drawdownMode="deal"
          drawdownSource="D1"
          riskRows={context.portfolio.riskRows}
          customPortfolio
        />
        <PortfolioRegressionSummary
          regression={context.portfolio.portfolioSummary?.regression ?? null}
          formatSymbol={(symbol) => `TEST-${symbol}`}
        />
      </>,
    )

    expect(screen.getByTestId('portfolio-equity-chart')).toHaveTextContent('1')
    expect(screen.getByTestId('portfolio-drawdown-chart')).toHaveTextContent('1')
    const summary = screen.getByRole('region', { name: 'Portfolio summary' })
    const health = within(summary).getByRole('region', { name: 'Portfolio health' })
    const factors = screen.getByRole('region', { name: 'Factor diagnostics' })

    expect(screen.getAllByText('10.00%')).toHaveLength(3)
    expect(within(summary).getByText('Daily SQN')).toBeInTheDocument()
    expect(within(summary).queryByText('ACF')).not.toBeInTheDocument()
    expect(within(health).getByText('Healthy')).toBeInTheDocument()
    expect(within(health).getByText('No shock')).toBeInTheDocument()
    expect(
      within(summary).queryByRole('region', { name: 'Factor diagnostics' }),
    ).not.toBeInTheDocument()
    expect(within(factors).getByLabelText('Factor betas')).toBeInTheDocument()
    expect(within(factors).getByText('TEST-EURUSD')).toBeInTheDocument()
    expect(within(factors).getByText('0.70')).toBeInTheDocument()
    expect(
      within(summary).getByText(/Results use the selected sleeve series and weights/),
    ).toBeInTheDocument()

    await user.hover(within(summary).getByRole('button', { name: 'Explain Daily SQN' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('daily-return measure')

    await user.click(screen.getByRole('switch', { name: 'Show values' }))
    expect(onShowNumbersChange).toHaveBeenCalledWith(false)
  })
})
