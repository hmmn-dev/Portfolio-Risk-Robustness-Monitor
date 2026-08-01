// @vitest-environment jsdom

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../../test/render'
import { createAppTheme } from '../../../theme'
import { getReportChartTheme } from '../chartTheme'
import { DrawdownChart, EquityChart } from '../charts'

const { echartsSpy } = vi.hoisted(() => ({
  echartsSpy: vi.fn(),
}))
const lightChartTheme = getReportChartTheme(createAppTheme('light'))

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
      />,
    )

    expect(screen.getByTestId('echarts')).toBeInTheDocument()
    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{
        data: number[]
        areaStyle: {
          opacity: number
          color: { colorStops: Array<{ offset: number; color: string }> }
        }
      }>
      xAxis: { axisLabel: { color: string }; nameTextStyle: { color: string } }
      yAxis: {
        name: string
        axisLabel: { color: string }
        splitLine: { lineStyle: { color: string } }
      }
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data[0]).toBe(0)
    expect(option.series[0].data[1]).toBeCloseTo(10)
    expect(option.series[0].areaStyle.opacity).toBe(0.09)
    expect(option.series[0].areaStyle.color.colorStops).toEqual([
      { offset: 0, color: lightChartTheme.primary },
      { offset: 1, color: 'rgba(0, 0, 0, 0)' },
    ])
    expect(option.xAxis.axisLabel.color).toBe(lightChartTheme.label)
    expect(option.xAxis.nameTextStyle.color).toBe(lightChartTheme.label)
    expect(option.yAxis.axisLabel.color).toBe(lightChartTheme.label)
    expect(option.yAxis.splitLine.lineStyle.color).toBe(lightChartTheme.grid)
    expect(option.yAxis.name).toBe('PnL %')
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('DD: -2.00%')
  })

  it('anchors log equity to starting capital so small returns keep useful bounds', () => {
    renderWithTheme(
      <EquityChart
        data={[
          { time: Date.UTC(2024, 0, 1), value: 33 },
          { time: Date.UTC(2024, 0, 2), value: 34.32 },
        ]}
        scaleMode="percent"
        pnlScaleMode="log"
        baseValue={10000}
      />,
    )

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{ data: number[] }>
      yAxis: {
        min: number
        max: number
        axisLabel: { formatter: (value: number) => string }
      }
    }
    expect(option.series[0].data[0]).toBeCloseTo(0)
    expect(option.series[0].data[1]).toBeCloseTo(Math.log(1.04))
    expect(option.yAxis.min).toBeGreaterThan(-0.02)
    expect(option.yAxis.max).toBeLessThan(0.06)
    expect(option.yAxis.axisLabel.formatter(0)).toBe('0.0')
    expect(option.yAxis.axisLabel.formatter(Math.log(1.04))).toBe('4.0')
  })

  it('rebases a ranged equity index to zero at its first visible observation', () => {
    renderWithTheme(
      <EquityChart
        data={[
          { time: Date.UTC(2025, 6, 31), value: 33 },
          { time: Date.UTC(2026, 6, 31), value: 34.65 },
        ]}
        scaleMode="percent"
      />,
    )

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{ data: number[] }>
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data[0]).toBe(0)
    expect(option.series[0].data[1]).toBeCloseTo(5)
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('PnL: 5.0%')
  })

  it('pins drawdown charts at zero and formats tooltip values', () => {
    renderWithTheme(
      <DrawdownChart
        data={[
          { time: Date.UTC(2024, 0, 1), value: 0 },
          { time: Date.UTC(2024, 0, 2), value: -4.25 },
        ]}
      />,
    )

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{
        data: number[]
        areaStyle: {
          opacity: number
          color: { colorStops: Array<{ offset: number; color: string }> }
        }
      }>
      yAxis: { max: number; name: string }
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data).toEqual([0, -4.25])
    expect(option.series[0].areaStyle.opacity).toBe(0.09)
    expect(option.series[0].areaStyle.color.colorStops).toEqual([
      { offset: 0, color: lightChartTheme.drawdown },
      { offset: 1, color: 'rgba(0, 0, 0, 0)' },
    ])
    expect(option.yAxis.max).toBe(0)
    expect(option.yAxis.name).toBe('Drawdown %')
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('DD: -4.25%')
  })
})
