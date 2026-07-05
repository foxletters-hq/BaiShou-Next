import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NativeSlider } from '../Slider'
import { useNativeTheme } from '../theme'

/** 持久化/迁移可能把数值存成字符串，统一兜底，避免 toFixed 等数值方法在 render 阶段崩溃 */
function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

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
  const safeValue = coerceNumber(value, coerceNumber(min, 0))
  const [draftValue, setDraftValue] = useState(safeValue)

  useEffect(() => {
    setDraftValue((prev) => (prev === safeValue ? prev : safeValue))
  }, [safeValue])

  const renderValue = commitOnChangeEnd ? draftValue : safeValue
  let display: string
  try {
    display = formatValue(renderValue)
  } catch {
    display = String(renderValue)
  }
  const sliderValue = commitOnChangeEnd ? safeValue : draftValue

  const handlePreview = useCallback(
    (next: number) => {
      setDraftValue((prev) => (prev === next ? prev : next))
      onPreviewChange?.(next)
      if (!commitOnChangeEnd && next !== safeValue) {
        onChange(next)
      }
    },
    [commitOnChangeEnd, onChange, onPreviewChange, safeValue]
  )

  const handleCommit = useCallback(
    (next: number) => {
      setDraftValue((prev) => (prev === next ? prev : next))
      if (next !== safeValue) {
        onChange(next)
      }
    },
    [onChange, safeValue]
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
            value={sliderValue}
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
