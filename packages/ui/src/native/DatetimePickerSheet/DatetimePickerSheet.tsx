import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, type ViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface DatetimePickerSheetProps extends ViewProps {
  visible: boolean
  onClose: () => void
  value: Date
  onChange: (date: Date) => void
  mode?: 'date' | 'time' | 'datetime'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function pad(num: number): string {
  return String(num).padStart(2, '0')
}

interface StepperProps {
  label: string
  value: number
  displayValue: string
  onIncrement: () => void
  onDecrement: () => void
  colors: Record<string, string>
}

const Stepper: React.FC<StepperProps> = ({
  label,
  value,
  displayValue,
  onIncrement,
  onDecrement,
  colors
}) => (
  <View style={styles.stepperColumn}>
    <TouchableOpacity
      onPress={onIncrement}
      activeOpacity={0.7}
      style={[styles.stepperBtn, { backgroundColor: colors.bgSurfaceNormal }]}
    >
      <Text style={[styles.stepperBtnText, { color: colors.primary }]}>+</Text>
    </TouchableOpacity>
    <View style={[styles.stepperValue, { backgroundColor: colors.primaryLight + '20' }]}>
      <Text style={[styles.stepperValueText, { color: colors.textPrimary }]}>{displayValue}</Text>
    </View>
    <TouchableOpacity
      onPress={onDecrement}
      activeOpacity={0.7}
      style={[styles.stepperBtn, { backgroundColor: colors.bgSurfaceNormal }]}
    >
      <Text style={[styles.stepperBtnText, { color: colors.primary }]}>-</Text>
    </TouchableOpacity>
    <Text style={[styles.stepperLabel, { color: colors.textTertiary }]}>{label}</Text>
  </View>
)

export const DatetimePickerSheet: React.FC<DatetimePickerSheetProps> = ({
  visible,
  onClose,
  value,
  onChange,
  mode = 'datetime',
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { t } = useTranslation()

  const [year, setYear] = useState(value.getFullYear())
  const [month, setMonth] = useState(value.getMonth())
  const [day, setDay] = useState(value.getDate())
  const [hour, setHour] = useState(value.getHours())
  const [minute, setMinute] = useState(value.getMinutes())

  useEffect(() => {
    if (visible) {
      setYear(value.getFullYear())
      setMonth(value.getMonth())
      setDay(value.getDate())
      setHour(value.getHours())
      setMinute(value.getMinutes())
    }
  }, [visible, value])

  const mergedDate = () => {
    const y = year
    const m = mode === 'time' ? value.getMonth() : month
    const d = mode === 'time' ? value.getDate() : Math.min(day, daysInMonth(year, month))
    const h = mode === 'date' ? 0 : hour
    const min = mode === 'date' ? 0 : minute
    return new Date(y, m, d, h, min, 0, 0)
  }

  const handleConfirm = () => {
    onChange(mergedDate())
    onClose()
  }

  const showDate = mode === 'date' || mode === 'datetime'
  const showTime = mode === 'time' || mode === 'datetime'

  const displayYear = String(year)
  const displayMonth = pad(month + 1)
  const displayDay = pad(Math.min(day, daysInMonth(year, month)))
  const displayHour = pad(hour)
  const displayMinute = pad(minute)

  const colorMap: Record<string, string> = {
    bgSurfaceNormal: colors.bgSurfaceNormal,
    primary: colors.primary,
    primaryLight: colors.primaryLight,
    textPrimary: colors.textPrimary,
    textTertiary: colors.textTertiary,
    bgSurface: colors.bgSurface,
    borderSubtle: colors.borderSubtle
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} {...props}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg
            }
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                {t('picker.cancel', '取消')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {showDate && showTime
                ? t('picker.datetime', '选择日期时间')
                : showDate
                  ? t('picker.date', '选择日期')
                  : t('picker.time', '选择时间')}
            </Text>
            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.7}>
              <Text style={[styles.confirmText, { color: colors.primary }]}>
                {t('picker.confirm', '确定')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            {showDate && (
              <View style={styles.stepperRow}>
                <Stepper
                  label={t('picker.year', '年')}
                  value={year}
                  displayValue={displayYear}
                  onIncrement={() => setYear((y) => clamp(y + 1, 1970, 2100))}
                  onDecrement={() => setYear((y) => clamp(y - 1, 1970, 2100))}
                  colors={colorMap}
                />
                <Stepper
                  label={t('picker.month', '月')}
                  value={month}
                  displayValue={displayMonth}
                  onIncrement={() => setMonth((m) => clamp(m + 1, 0, 11))}
                  onDecrement={() => setMonth((m) => clamp(m - 1, 0, 11))}
                  colors={colorMap}
                />
                <Stepper
                  label={t('picker.day', '日')}
                  value={day}
                  displayValue={displayDay}
                  onIncrement={() => setDay((d) => clamp(d + 1, 1, daysInMonth(year, month)))}
                  onDecrement={() => setDay((d) => clamp(d - 1, 1, daysInMonth(year, month)))}
                  colors={colorMap}
                />
              </View>
            )}
            {showTime && (
              <View style={styles.stepperRow}>
                <Stepper
                  label={t('picker.hour', '时')}
                  value={hour}
                  displayValue={displayHour}
                  onIncrement={() => setHour((h) => clamp(h + 1, 0, 23))}
                  onDecrement={() => setHour((h) => clamp(h - 1, 0, 23))}
                  colors={colorMap}
                />
                <Stepper
                  label={t('picker.minute', '分')}
                  value={minute}
                  displayValue={displayMinute}
                  onIncrement={() => setMinute((m) => clamp(m + 1, 0, 59))}
                  onDecrement={() => setMinute((m) => clamp(m - 1, 0, 59))}
                  colors={colorMap}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  sheet: {
    paddingBottom: 34
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  cancelText: {
    fontSize: 15
  },
  title: {
    fontSize: 16,
    fontWeight: '600'
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600'
  },
  pickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12
  },
  stepperColumn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
    maxWidth: 80
  },
  stepperBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '600'
  },
  stepperValue: {
    width: 56,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  },
  stepperLabel: {
    fontSize: 11
  }
})
