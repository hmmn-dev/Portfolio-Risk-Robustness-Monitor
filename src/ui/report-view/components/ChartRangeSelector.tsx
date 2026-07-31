import { Box, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs, { type Dayjs } from 'dayjs'
import {
  formatDateInputValue,
  parseDateInputValue,
  resolveChartRange,
  type ChartRangeBounds,
  type ChartRangePreset,
  type ChartRangeSelection,
} from '../helpers/chartRange'

const RANGE_OPTIONS: Array<{ value: ChartRangePreset; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '5y', label: '5Y' },
  { value: '3y', label: '3Y' },
  { value: '1y', label: '1Y' },
]

const toPickerDate = (timestamp: number) => {
  const value = formatDateInputValue(timestamp)
  return value ? dayjs(value) : null
}

const fromPickerDate = (value: Dayjs | null) =>
  value?.isValid() ? parseDateInputValue(value.format('YYYY-MM-DD')) : null

type ChartRangeSelectorProps = {
  value: ChartRangeSelection
  bounds: ChartRangeBounds | null
  onChange: (value: ChartRangeSelection) => void
  ariaLabel?: string
}

const ChartRangeSelector = ({
  value,
  bounds,
  onChange,
  ariaLabel = 'Equity date range',
}: ChartRangeSelectorProps) => {
  const resolvedRange = resolveChartRange(bounds, value)
  const startTime = resolvedRange?.minTime ?? Number.NaN
  const endTime = resolvedRange?.maxTime ?? Number.NaN
  const minimumDate = bounds ? (toPickerDate(bounds.minTime) ?? undefined) : undefined
  const maximumDate = bounds ? (toPickerDate(bounds.maxTime) ?? undefined) : undefined

  const updateStartTime = (nextStartTime: number) => {
    onChange({
      type: 'custom',
      startTime: nextStartTime,
      endTime: Math.max(nextStartTime, endTime),
    })
  }

  const updateEndTime = (nextEndTime: number) => {
    onChange({
      type: 'custom',
      startTime: Math.min(startTime, nextEndTime),
      endTime: nextEndTime,
    })
  }

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 1, md: 2 }}
      alignItems={{ md: 'center' }}
      sx={{ width: { xs: '100%', md: 'auto' }, flexShrink: 0 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))',
          gap: 1,
          width: { xs: '100%', md: 'auto' },
        }}
      >
        <DatePicker
          label="From"
          value={toPickerDate(startTime)}
          minDate={minimumDate}
          maxDate={maximumDate}
          disabled={!bounds}
          format="DD MMM YYYY"
          onChange={(nextValue) => {
            const nextTime = fromPickerDate(nextValue)
            if (nextTime != null) updateStartTime(nextTime)
          }}
          slotProps={{
            textField: {
              size: 'small',
              'aria-label': `${ariaLabel} start date`,
              inputProps: { 'aria-label': `${ariaLabel} start date value` },
              sx: { width: { md: 156 } },
            },
          }}
        />
        <DatePicker
          label="To"
          value={toPickerDate(endTime)}
          minDate={minimumDate}
          maxDate={maximumDate}
          disabled={!bounds}
          format="DD MMM YYYY"
          onChange={(nextValue) => {
            const nextTime = fromPickerDate(nextValue)
            if (nextTime != null) updateEndTime(nextTime)
          }}
          slotProps={{
            textField: {
              size: 'small',
              'aria-label': `${ariaLabel} end date`,
              inputProps: { 'aria-label': `${ariaLabel} end date value` },
              sx: { width: { md: 156 } },
            },
          }}
        />
      </Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value.type === 'preset' ? value.preset : null}
        onChange={(_event, nextValue: ChartRangePreset | null) => {
          if (nextValue) onChange({ type: 'preset', preset: nextValue })
        }}
        aria-label={ariaLabel}
        sx={{
          flexShrink: 0,
          '& .MuiToggleButton-root': {
            minWidth: 50,
            px: 1.5,
            py: 0.625,
            fontWeight: 600,
            textTransform: 'none',
          },
        }}
      >
        {RANGE_OPTIONS.map((option) => (
          <ToggleButton key={option.value} value={option.value} aria-label={option.label}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  )
}

export default ChartRangeSelector
