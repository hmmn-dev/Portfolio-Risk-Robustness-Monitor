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

  it('renders equity observations as unsmoothed end-aligned steps', () => {
    const points = [
      { time: Date.UTC(2024, 0, 1), value: 1 },
      { time: Date.UTC(2024, 0, 2), value: 1.1 },
      { time: Date.UTC(2024, 0, 3), value: 0.9 },
    ]

    renderWithTheme(<EquityChart data={points} scaleMode="currency" />)

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{
        data: Array<[number, number]>
        smooth: boolean
        step?: 'start' | 'middle' | 'end'
      }>
    }
    expect(option.series[0]).toMatchObject({
      data: points.map((point) => [point.time, point.value]),
      smooth: false,
      step: 'end',
    })
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
        data: Array<[number, number]>
        areaStyle: {
          opacity: number
          color: { colorStops: Array<{ offset: number; color: string }> }
        }
      }>
      xAxis: {
        type: string
        splitNumber: number
        name: string
        axisLabel: {
          color: string
          hideOverlap: boolean
          showMinLabel: boolean
          showMaxLabel: boolean
          formatter: (value: number) => string
        }
        axisTick: { customValues?: number[] }
        splitLine: { show: boolean }
        nameTextStyle: { color: string }
      }
      grid: { left: number; right: number; bottom: number; containLabel: boolean }
      yAxis: {
        name: string
        axisLabel: { color: string }
        splitLine: { showMinLine: boolean; lineStyle: { color: string } }
      }
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data[0][1]).toBe(0)
    expect(option.series[0].data[1][1]).toBeCloseTo(10)
    expect(option.series[0].areaStyle.opacity).toBe(0.09)
    expect(option.series[0].areaStyle.color.colorStops).toEqual([
      { offset: 0, color: lightChartTheme.primary },
      { offset: 1, color: 'rgba(0, 0, 0, 0)' },
    ])
    expect(option.xAxis.axisLabel.color).toBe(lightChartTheme.label)
    expect(option.xAxis).toMatchObject({ type: 'time', splitNumber: 6 })
    expect(option.xAxis.axisLabel).toMatchObject({
      hideOverlap: true,
      showMinLabel: true,
      showMaxLabel: true,
    })
    expect(option.xAxis.axisLabel.formatter(Date.UTC(2024, 0, 1))).toMatch(/24/)
    expect(option.xAxis.axisTick.customValues).toBeUndefined()
    expect(option.xAxis.splitLine.show).toBe(false)
    expect(option.xAxis.name).toBe('')
    expect(option.grid).toMatchObject({ left: 64, right: 16, bottom: 44, containLabel: false })
    expect(option).not.toHaveProperty('height')
    expect(option.xAxis.nameTextStyle.color).toBe(lightChartTheme.label)
    expect(option.yAxis.axisLabel.color).toBe(lightChartTheme.label)
    expect(option.yAxis.splitLine.lineStyle.color).toBe(lightChartTheme.grid)
    expect(option.yAxis.splitLine.showMinLine).toBe(false)
    expect(option.yAxis.name).toBe('PnL %')
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('DD: -2.00%')
  })

  it('uses consistent year labels and month ticks for three-year preset ranges', () => {
    renderWithTheme(
      <EquityChart
        data={[
          { time: Date.UTC(2023, 7, 2), value: 1 },
          { time: Date.UTC(2026, 6, 31), value: 1.5 },
        ]}
        scaleMode="percent"
      />,
    )

    const option = echartsSpy.mock.calls[0][0].option as {
      useUTC: boolean
      xAxis: {
        axisLabel: { formatter: (value: number) => string; customValues: number[] }
        axisTick: {
          show: boolean
          customValues: number[]
          lineStyle: { color: string; opacity: number }
        }
        splitLine: { show: boolean }
      }
    }
    const monthTickValues = option.xAxis.axisTick.customValues

    expect(option.useUTC).toBe(true)
    expect(option.xAxis.axisLabel.formatter(Date.UTC(2023, 7, 2))).toBe('2023')
    expect(option.xAxis.axisLabel.formatter(Date.UTC(2024, 0, 1))).toBe('2024')
    expect(option.xAxis.axisLabel.formatter(Date.UTC(2026, 6, 31))).toBe('')
    expect(option.xAxis.axisLabel.customValues).toEqual([
      Date.UTC(2023, 7, 2),
      Date.UTC(2024, 0, 1),
      Date.UTC(2025, 0, 1),
      Date.UTC(2026, 0, 1),
    ])
    expect(option.xAxis.splitLine.show).toBe(false)
    expect(option.xAxis.axisTick).toMatchObject({
      show: true,
      lineStyle: { color: lightChartTheme.axis, opacity: 0.6 },
    })
    expect(monthTickValues).toHaveLength(36)
    expect(monthTickValues).toContain(Date.UTC(2023, 8, 1))
    expect(monthTickValues).toContain(Date.UTC(2024, 0, 1))
    expect(monthTickValues).toContain(Date.UTC(2026, 6, 1))
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
      series: Array<{ data: Array<[number, number]> }>
      yAxis: {
        min: number
        max: number
        axisLabel: { formatter: (value: number) => string }
      }
    }
    expect(option.series[0].data[0][1]).toBeCloseTo(0)
    expect(option.series[0].data[1][1]).toBeCloseTo(Math.log(1.04))
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
      series: Array<{ data: Array<[number, number]> }>
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data[0][1]).toBe(0)
    expect(option.series[0].data[1][1]).toBeCloseTo(5)
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
        data: Array<[number, number]>
        areaStyle: {
          opacity: number
          color: { colorStops: Array<{ offset: number; color: string }> }
        }
      }>
      yAxis: { max: number; name: string }
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series[0].data).toEqual([
      [Date.UTC(2024, 0, 1), 0],
      [Date.UTC(2024, 0, 2), -4.25],
    ])
    expect(option.series[0].areaStyle.opacity).toBe(0.09)
    expect(option.series[0].areaStyle.color.colorStops).toEqual([
      { offset: 0, color: lightChartTheme.drawdown },
      { offset: 1, color: 'rgba(0, 0, 0, 0)' },
    ])
    expect(option.yAxis.max).toBe(0)
    expect(option.yAxis.name).toBe('Drawdown %')
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('DD: -4.25%')
  })

  it('renders realized fallback segments with warning styling and explains their source', () => {
    const points = [
      { time: Date.UTC(2024, 0, 1), value: 0 },
      { time: Date.UTC(2024, 0, 2), value: -1 },
      { time: Date.UTC(2024, 0, 3), value: -2 },
    ]

    renderWithTheme(<DrawdownChart data={points} realizedFallback={[points[2]]} />)

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{
        name: string
        data: Array<[number, number | null]>
        lineStyle: { color: string }
        areaStyle: { color: { colorStops: Array<{ offset: number; color: string }> } }
        markLine?: {
          silent: boolean
          symbol: string
          z: number
          label: { show: boolean }
          lineStyle: { color: string; type: string; width: number }
          data: Array<{ xAxis: number }>
        }
      }>
      tooltip: { formatter: (params: Array<{ dataIndex: number }>) => string }
    }
    expect(option.series).toHaveLength(2)
    expect(option.series[1].markLine).toBeUndefined()
    expect(option.series[0].data).toEqual([
      [points[0].time, 0],
      [points[1].time, -1],
      [points[2].time, null],
    ])
    expect(option.series[1].data).toEqual([
      [points[0].time, null],
      [points[1].time, -1],
      [points[2].time, -2],
    ])
    expect(option.series[1].lineStyle.color).toBe(lightChartTheme.drawdownFallback)
    expect(option.series[1].areaStyle.color.colorStops[0].color).toBe(
      lightChartTheme.drawdownFallback,
    )
    expect(option.series[0].markLine).toEqual({
      silent: true,
      symbol: 'none',
      z: 8,
      label: { show: false },
      lineStyle: {
        color: lightChartTheme.drawdownBoundary,
        type: 'dashed',
        width: 1,
      },
      data: [{ xAxis: points[2].time }],
    })
    expect(option.tooltip.formatter([{ dataIndex: 2 }])).toContain(
      'Realized DD (candles unavailable for this period)',
    )
    expect(echartsSpy.mock.calls[0][0].replaceMerge).toBe('series')
  })

  it('does not propagate an initial realized fallback across MTM candle coverage', () => {
    const points = [0, -1, -2, -3].map((value, index) => ({
      time: Date.UTC(2024, 0, index + 1),
      value,
    }))

    renderWithTheme(<DrawdownChart data={points} realizedFallback={[points[0]]} />)

    const option = echartsSpy.mock.calls[0][0].option as {
      series: Array<{ data: Array<[number, number | null]> }>
    }
    expect(option.series[0].data).toEqual([
      [points[0].time, null],
      [points[1].time, -1],
      [points[2].time, -2],
      [points[3].time, -3],
    ])
    expect(option.series[1].data).toEqual([
      [points[0].time, 0],
      [points[1].time, -1],
      [points[2].time, null],
      [points[3].time, null],
    ])
  })

  it('keeps one long-range drawdown-source boundary without monthly ticks', () => {
    const points = [
      { time: Date.UTC(2021, 6, 31), value: 0 },
      { time: Date.UTC(2026, 6, 30), value: -1 },
      { time: Date.UTC(2026, 6, 31), value: -2 },
    ]

    renderWithTheme(<DrawdownChart data={points} realizedFallback={[points[2]]} />)

    const option = echartsSpy.mock.calls[0][0].option as {
      xAxis: { axisTick: { customValues: number[] } }
      series: Array<{
        markLine?: {
          data: Array<{
            xAxis: number
            lineStyle?: { color: string; type: string; width: number }
          }>
        }
      }>
    }
    const markLineData = option.series[0].markLine?.data ?? []
    expect(option.xAxis.axisTick.customValues).toEqual([
      points[0].time,
      Date.UTC(2022, 0, 1),
      Date.UTC(2023, 0, 1),
      Date.UTC(2024, 0, 1),
      Date.UTC(2025, 0, 1),
      Date.UTC(2026, 0, 1),
    ])
    expect(markLineData).toEqual([
      {
        xAxis: points[2].time,
      },
    ])
    expect(option.series[1].markLine).toBeUndefined()
  })
})
