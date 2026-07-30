// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../../test/render'
import { DrawdownChart, EquityChart } from '../charts'

const { echartsSpy } = vi.hoisted(() => ({
  echartsSpy: vi.fn(),
}))

vi.mock('echarts-for-react', () => ({
  default: (props: { option: Record<string, unknown>; style: Record<string, unknown> }) => {
    echartsSpy(props)
    return <div data-testid="echarts" />
  },
}))

describe('report charts', () => {
  beforeEach(() => {
    echartsSpy.mockClear()
  })

  it('converts an equity index to percentage PnL and includes drawdown in the tooltip', () => {
    renderWithTheme(
      <EquityChart
        data={[
          { time: Date.UTC(2024, 0, 1), value: 1 },
          { time: Date.UTC(2024, 0, 2), value: 1.1 },
        ]}
        drawdownSeries={[
          { time: Date.UTC(2024, 0, 1), value: 0 },
          { time: Date.UTC(2024, 0, 2), value: -2 },
        ]}
        scaleMode="percent"
        color="#123456"
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    expect(screen.getByTestId('echarts')).toBeInTheDocument()
    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{ data: number[] }>
      yAxis: { name: string }
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data[0]).toBe(0)
    expect(option.series[0].data[1]).toBeCloseTo(10)
    expect(option.yAxis.name).toBe('PnL %')
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('DD: -2.00%')
  })

  it('pins drawdown charts at zero and formats tooltip values', () => {
    renderWithTheme(
      <DrawdownChart
        data={[
          { time: Date.UTC(2024, 0, 1), value: 0 },
          { time: Date.UTC(2024, 0, 2), value: -4.25 },
        ]}
        axisColor="#555555"
        gridColor="#dddddd"
      />,
    )

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{ data: number[] }>
      yAxis: { max: number; name: string }
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data).toEqual([0, -4.25])
    expect(option.yAxis.max).toBe(0)
    expect(option.yAxis.name).toBe('Drawdown %')
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('DD: -4.25%')
  })
})
