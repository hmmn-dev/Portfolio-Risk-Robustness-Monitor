// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createReport, createReportContext } from '../../../../test/reportFixtures'
import { renderWithTheme } from '../../../../test/render'
import SleeveSection from '../SleeveSection'
import SleeveSectionPrint from '../SleeveSectionPrint'

vi.mock('../../charts', () => ({
  EquityChart: () => <div data-testid="equity-chart" />,
  DrawdownChart: () => <div data-testid="drawdown-chart" />,
}))

vi.mock('../../chartOptions', () => ({
  buildLineOptions: () => ({}),
}))

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="rolling-chart" />,
}))

const report = createReport()
const item = report.contributions[0]
const context = createReportContext()

describe('SleeveSection', () => {
  it('renders contribution charts, source label, and rolling metrics', () => {
    renderWithTheme(
      <SleeveSection
        item={item}
        metrics={context.selectedSleeveMetrics}
        baseCapital={10000}
        drawdownSeries={item.drawdown}
        drawdownSource="H1"
        pnlColor="#123456"
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    expect(screen.getByRole('heading', { name: item.sleeve })).toBeInTheDocument()
    expect(screen.getByText('Contribution equity')).toBeInTheDocument()
    expect(screen.getByText('Contribution drawdown (H1 candles)')).toBeInTheDocument()
    expect(screen.getByText('Alpha (rolling)')).toBeInTheDocument()
    expect(screen.getAllByTestId('rolling-chart')).toHaveLength(3)
  })

  it('supports a titleless loading state without rolling charts', () => {
    renderWithTheme(
      <SleeveSection
        item={item}
        metrics={null}
        showTitle={false}
        baseCapital={10000}
        drawdownSeries={item.drawdown}
        pnlColor="#123456"
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    expect(screen.queryByRole('heading', { name: item.sleeve })).not.toBeInTheDocument()
    expect(screen.queryByTestId('rolling-chart')).not.toBeInTheDocument()
  })
})

describe('SleeveSectionPrint', () => {
  it('renders all print charts from precomputed metrics', () => {
    renderWithTheme(
      <SleeveSectionPrint
        item={item}
        metrics={context.selectedSleeveMetrics!}
        baseCapital={10000}
        drawdownSeries={item.drawdown}
        drawdownSource="D1"
        pnlColor="#123456"
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    expect(screen.getByText('Contribution drawdown (D1 candles)')).toBeInTheDocument()
    expect(screen.getAllByTestId('rolling-chart')).toHaveLength(3)
  })
})
