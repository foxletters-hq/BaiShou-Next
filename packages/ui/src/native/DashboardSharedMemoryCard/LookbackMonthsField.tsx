import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import { SHARED_MEMORY_LOOKBACK_MIN, SHARED_MEMORY_LOOKBACK_SLIDER_BASE } from '@baishou/shared'
import { DesktopStyleSlider } from './DesktopStyleSlider'
import { useNativeTheme } from '../../native/theme'

/** 滑块 + 数字输入：拖动预览仅在本组件内更新，避免牵动整张卡片重渲染 */
export function LookbackMonthsField({
  lookbackMonths,
  label,
  onMonthsChanged
}: {
  lookbackMonths: number
  label: string
  onMonthsChanged: (val: number) => void
}) {
  const { colors } = useNativeTheme()
  const [displayMonths, setDisplayMonths] = useState(lookbackMonths)
  const numberInputRef = useRef<TextInput>(null)
  const editingRef = useRef(false)

  const syncNumberDisplay = useCallback((next: number) => {
    numberInputRef.current?.setNativeProps({ text: String(next) })
  }, [])

  useEffect(() => {
    setDisplayMonths((prev) => (prev === lookbackMonths ? prev : lookbackMonths))
    if (!editingRef.current) {
      syncNumberDisplay(lookbackMonths)
    }
  }, [lookbackMonths, syncNumberDisplay])

  const commitMonths = useCallback(
    (raw: number) => {
      const clamped = Math.max(SHARED_MEMORY_LOOKBACK_MIN, Math.round(raw))
      setDisplayMonths(clamped)
      syncNumberDisplay(clamped)
      if (clamped !== lookbackMonths) {
        onMonthsChanged(clamped)
      }
    },
    [lookbackMonths, onMonthsChanged, syncNumberDisplay]
  )

  const handleSliderPreview = useCallback(
    (next: number) => {
      if (editingRef.current) return
      syncNumberDisplay(next)
    },
    [syncNumberDisplay]
  )

  const sliderMax = Math.max(SHARED_MEMORY_LOOKBACK_SLIDER_BASE, lookbackMonths)

  return (
    <View style={fieldStyles.controls}>
      <View style={fieldStyles.labelRow}>
        <Text style={[fieldStyles.label, { color: colors.textPrimary }]}>{label}</Text>
        <TextInput
          ref={numberInputRef}
          style={[
            fieldStyles.numberInput,
            {
              color: colors.textPrimary,
              borderColor: colors.borderMuted,
              backgroundColor: colors.bgSurface
            }
          ]}
          defaultValue={String(displayMonths)}
          keyboardType="number-pad"
          maxLength={4}
          selectTextOnFocus
          onFocus={() => {
            editingRef.current = true
          }}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '')
            if (digits.length === 0) return
            const n = parseInt(digits, 10)
            if (!Number.isNaN(n)) {
              setDisplayMonths(Math.max(SHARED_MEMORY_LOOKBACK_MIN, n))
            }
          }}
          onEndEditing={() => {
            editingRef.current = false
            commitMonths(displayMonths)
          }}
          onBlur={() => {
            editingRef.current = false
            commitMonths(displayMonths)
          }}
        />
      </View>
      <View style={fieldStyles.sliderWrap}>
        <DesktopStyleSlider
          value={lookbackMonths}
          minimumValue={SHARED_MEMORY_LOOKBACK_MIN}
          maximumValue={sliderMax}
          step={1}
          onPreviewChange={handleSliderPreview}
          onValueChange={commitMonths}
        />
      </View>
    </View>
  )
}

const fieldStyles = StyleSheet.create({
  controls: {
    gap: 8
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  numberInput: {
    width: 64,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 10
  },
  sliderWrap: {
    width: '100%',
    justifyContent: 'center',
    minHeight: 44
  }
})
