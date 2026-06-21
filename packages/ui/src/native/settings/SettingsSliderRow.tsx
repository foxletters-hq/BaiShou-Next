import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NativeSlider } from '../Slider'
import { useNativeTheme } from '../theme'

export interface SettingsSliderRowProps {
  title: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** 拖动过程中预览回调，不触发持久化 */
  onPreviewChange?: (v: number) => void
  formatValue?: (v: number) => string
  /** 松手后再提交，拖动时仅更新本地预览（与共同回忆面板一致） */
  commitOnChangeEnd?: boolean
}

export const SettingsSliderRow: React.FC<SettingsSliderRowProps> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
  onPreviewChange,
  formatValue = (v) => String(v),
  commitOnChangeEnd = true
}) => {
  const { colors } = useNativeTheme()
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    setDraftValue((prev) => (prev === value ? prev : value))
  }, [value])

  const normalize = (raw: number) => (step >= 1 ? Math.round(raw) : raw)

  const display = formatValue(commitOnChangeEnd ? draftValue : value)

  const handlePreview = useCallback(
    (next: number) => {
      setDraftValue((prev) => (prev === next ? prev : next))
      onPreviewChange?.(next)
      if (!commitOnChangeEnd && next !== value) {
        onChange(next)
      }
    },
    [commitOnChangeEnd, onChange, onPreviewChange, value]
  )

  const handleCommit = useCallback(
    (next: number) => {
      setDraftValue((prev) => (prev === next ? prev : next))
      if (next !== value) {
        onChange(next)
      }
    },
    [onChange, value]
  )

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
        <View style={styles.sliderWrap}>
          <NativeSlider
            value={value}
            minValue={min}
            maxValue={max}
            step={step}
            commitOnChangeEnd={commitOnChangeEnd}
            onChange={handlePreview}
            onChangeEnd={handleCommit}
          />
        </View>
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
  sliderWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8
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
