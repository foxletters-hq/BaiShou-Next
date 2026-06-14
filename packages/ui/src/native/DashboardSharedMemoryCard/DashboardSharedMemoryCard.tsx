import { useTranslation } from 'react-i18next'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { DesktopStyleSlider } from './DesktopStyleSlider'
import { useNativeTheme } from '../../native/theme'

const SLIDER_MIN = 1
const SLIDER_BASE_MAX = 60

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number
  onMonthsChanged: (val: number) => void
  onCopyContext: () => void
}

/** 滑块 + 数字输入：拖动预览仅在本组件内更新，避免牵动整张卡片重渲染 */
function LookbackMonthsField({
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
      const clamped = Math.max(SLIDER_MIN, Math.round(raw))
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

  const sliderMax = Math.max(SLIDER_BASE_MAX, lookbackMonths)

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
              setDisplayMonths(Math.max(SLIDER_MIN, n))
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
          minimumValue={SLIDER_MIN}
          maximumValue={sliderMax}
          step={1}
          onPreviewChange={handleSliderPreview}
          onValueChange={commitMonths}
        />
      </View>
    </View>
  )
}

export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardBorder = colors.borderMuted

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: cardBorder }]}>
      <View style={styles.header}>
        <MaterialIcons
          name="format-quote"
          size={20}
          color={colors.primary}
          style={styles.headerIcon}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('summary.shared_memory')}
        </Text>
      </View>

      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t('summary.shared_memory_desc')}
      </Text>

      <LookbackMonthsField
        lookbackMonths={lookbackMonths}
        label={t('summary.lookback_label')}
        onMonthsChanged={onMonthsChanged}
      />

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={onCopyContext}
      >
        <MaterialIcons name="content-copy" size={16} color="#ffffff" style={styles.btnIcon} />
        <Text style={styles.btnText}>{t('summary.copy_memories')}</Text>
      </TouchableOpacity>
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

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  headerIcon: {
    marginRight: 8
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 16
  },
  desc: {
    fontSize: 13,
    lineHeight: 20.8,
    marginBottom: 24
  },
  btn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnIcon: {
    marginRight: 6
  },
  btnText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#ffffff'
  }
})
