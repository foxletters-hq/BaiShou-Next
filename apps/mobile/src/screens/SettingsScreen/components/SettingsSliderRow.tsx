import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '@baishou/ui/native'

export interface SettingsSliderRowProps {
  title: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
}

/** 对齐桌面 WebSearchSettingsView：较粗轨道 + 右侧数值块 */
export const SettingsSliderRow: React.FC<SettingsSliderRowProps> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (v) => String(v)
}) => {
  const { colors } = useNativeTheme()
  const display = formatValue(value)

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.controlRow}>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={(v) => onChange(step >= 1 ? Math.round(v) : v)}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.bgSurfaceNormal}
          thumbTintColor={colors.primary}
        />
        <View style={[styles.valueBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.valueText, { color: colors.primary }]}>{display}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginBottom: 4 },
  header: { marginBottom: 8 },
  textGroup: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  slider: {
    flex: 1,
    height: 40
  },
  valueBadge: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  valueText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  }
})
