import { describe, expect, it } from 'vitest'
import { appBackgroundStyles, createAppTheme } from '../theme'
import { getReportChartTheme } from '../ui/report-view/chartTheme'

describe('application theme', () => {
  it('defines shared typography and variant-specific surface behavior', () => {
    const theme = createAppTheme('light')

    expect(theme.typography.subtitle1).toMatchObject({ fontWeight: 600, letterSpacing: 0 })
    expect(theme.typography.body2).toMatchObject({ letterSpacing: 0 })
    expect(theme.components?.MuiPaper).toMatchObject({
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: expect.any(String) },
      },
    })
    expect(theme.components?.MuiChip).toMatchObject({
      styleOverrides: {
        root: { borderRadius: 999 },
        outlined: { backgroundColor: 'transparent' },
      },
    })
  })

  it('derives report chart colors from each active palette', () => {
    const lightTheme = createAppTheme('light')
    const darkTheme = createAppTheme('dark')
    const lightChart = getReportChartTheme(lightTheme)
    const darkChart = getReportChartTheme(darkTheme)

    expect(lightChart.primary).toBe(lightTheme.palette.primary.main)
    expect(lightChart.drawdown).toBe(lightTheme.palette.error.main)
    expect(lightChart.label).toBe(lightTheme.palette.text.secondary)
    expect(lightChart.areaOpacity).toBeLessThan(darkChart.areaOpacity)
    expect(darkChart.label).toBe(darkTheme.palette.text.secondary)
  })

  it('keeps global document styling in the MUI global-style contract', () => {
    const styles = appBackgroundStyles('dark')

    expect(styles.body).toMatchObject({ margin: 0, minWidth: 320, minHeight: '100vh' })
    expect(styles.html).toMatchObject({ fontSynthesis: 'none' })
    expect(styles.a).toEqual({ color: 'inherit', textDecoration: 'none' })
  })
})
