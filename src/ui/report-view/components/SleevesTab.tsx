import { Box, Divider, Stack, Tab, Tabs, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import LazySection from '../LazySection'
import SleeveSection from './SleeveSection'
import { useReportViewContext } from './ReportViewContext'

const SleevesTab = () => {
  const {
    report,
    sleeves,
    selectedContribution,
    onSelectSleeve,
    selectedSleeveMetrics,
    buildSleeveMetrics,
    sleeveViewMode,
    onSleeveViewModeChange,
    drawdownMode,
    onDrawdownModeChange,
    hasMtmDrawdown,
    pnlScaleMode,
    onPnlScaleModeChange,
    rollingWindow,
    onRollingWindowChange,
    metricWindow,
    baseCapital,
    pnlColor,
    axisColor,
    gridColor,
    theme,
    isDark,
    getSleeveDrawdown,
    getSleeveDrawdownSource,
    allSleevesPlaceholderHeight,
  } = useReportViewContext()

  return (
    <Box
      sx={{
        display: { xs: 'block', lg: 'flex' },
        gap: 3,
        height: { lg: sleeveViewMode === 'all' ? 'auto' : 'calc(100dvh - 190px)' },
        overflow: { lg: sleeveViewMode === 'all' ? 'visible' : 'hidden' },
        minHeight: 0,
      }}
    >
      {sleeveViewMode === 'single' && (
        <Box
          sx={{
            width: { xs: '100%', lg: 260 },
            borderRight: { lg: `1px solid ${gridColor}` },
            height: { lg: '100%' },
            overflowY: { lg: 'auto' },
            minHeight: 0,
          }}
        >
          <Tabs
            orientation="vertical"
            value={Math.max(0, sleeves.findIndex((sleeve) => sleeve === selectedContribution?.sleeve))}
            onChange={(_event, value) => onSelectSleeve(sleeves[value])}
            variant="scrollable"
            sx={{
              height: '100%',
              '& .MuiTab-root': {
                alignItems: 'flex-start',
                textAlign: 'left',
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 48,
              },
            }}
          >
            {sleeves.map((sleeve) => (
              <Tab key={sleeve} label={sleeve} />
            ))}
          </Tabs>
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          pr: { lg: 1 },
          height: { lg: sleeveViewMode === 'all' ? 'auto' : '100%' },
          overflowY: { lg: sleeveViewMode === 'all' ? 'visible' : 'auto' },
          minHeight: sleeveViewMode === 'all' ? 'auto' : 0,
        }}
      >
        <Stack spacing={2} sx={{ maxWidth: 1200, mx: 'auto', width: '100%', pb: 4 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Typography variant="h6">
              {sleeveViewMode === 'single' ? selectedContribution?.sleeve : 'All sleeves'}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <ToggleButtonGroup
              size="small"
              value={drawdownMode}
              exclusive
              onChange={(_event, value) => {
                if (value) onDrawdownModeChange(value)
              }}
            >
              <ToggleButton value="deal">Realized DD</ToggleButton>
              <ToggleButton value="mtm" disabled={!hasMtmDrawdown}>
                In-Trade DD
              </ToggleButton>
            </ToggleButtonGroup>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToggleButtonGroup
              size="small"
              value={pnlScaleMode}
              exclusive
              onChange={(_event, value) => {
                if (value) onPnlScaleModeChange(value)
              }}
            >
              <ToggleButton value="linear">Linear</ToggleButton>
              <ToggleButton value="log">Log</ToggleButton>
            </ToggleButtonGroup>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={sleeveViewMode}
              onChange={(_event, value) => {
                if (value) onSleeveViewModeChange(value)
              }}
            >
              <ToggleButton value="single">Tabbed</ToggleButton>
              <ToggleButton value="all">All sleeves</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {sleeveViewMode === 'single' ? (
            selectedContribution ? (
              <SleeveSection
                item={selectedContribution}
                metrics={selectedSleeveMetrics}
                showTitle={false}
                baseCapital={baseCapital}
                drawdownSeries={getSleeveDrawdown(selectedContribution)}
                drawdownSource={getSleeveDrawdownSource(selectedContribution)}
                pnlScaleMode={pnlScaleMode}
                pnlColor={pnlColor}
                axisColor={axisColor}
                gridColor={gridColor}
              />
            ) : null
          ) : (
            report.contributions.map((item, index) => {
              const metrics = buildSleeveMetrics(item)
              return (
                <LazySection
                  key={item.sleeve}
                  placeholderHeight={allSleevesPlaceholderHeight}
                  disabled={false}
                >
                  <Stack spacing={2}>
                    <SleeveSection
                      item={item}
                      metrics={metrics}
                      baseCapital={baseCapital}
                      drawdownSeries={getSleeveDrawdown(item)}
                      drawdownSource={getSleeveDrawdownSource(item)}
                      pnlScaleMode={pnlScaleMode}
                      pnlColor={pnlColor}
                      axisColor={axisColor}
                      gridColor={gridColor}
                    />
                    {index < report.contributions.length - 1 && <Divider />}
                  </Stack>
                </LazySection>
              )
            })
          )}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={rollingWindow}
            onChange={(_event, value) => {
              if (value) onRollingWindowChange(value)
            }}
            aria-label="Rolling window"
            sx={{
              width: 'fit-content',
              display: 'inline-flex',
              borderRadius: 999,
              border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`,
              overflow: 'hidden',
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.5,
                border: 0,
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.04),
              },
              '& .MuiToggleButton-root.Mui-selected': {
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.getContrastText(theme.palette.primary.main),
              },
              '& .MuiToggleButton-root.Mui-selected:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            <ToggleButton value={metricWindow.short}>3M</ToggleButton>
            <ToggleButton value={metricWindow.long}>6M</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>
    </Box>
  )
}

export default SleevesTab
