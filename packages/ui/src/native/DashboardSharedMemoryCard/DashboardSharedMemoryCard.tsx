import { useTranslation } from 'react-i18next'
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Input } from '../Input/Input'
import { DesktopStyleSlider } from './DesktopStyleSlider'
import { useNativeTheme } from '../../native/theme'

const SLIDER_MIN = 1
const SLIDER_BASE_MAX = 60

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number
  onMonthsChanged: (val: number) => void
  onCopyContext: () => void
}

export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardBorder = colors.dashboardCardBorder ?? 'rgba(148, 163, 184, 0.5)'
  const [draftMonths, setDraftMonths] = useState(String(lookbackMonths))

  const commitMonths = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10)
      if (Number.isNaN(n)) {
        setDraftMonths(String(lookbackMonths))
        return
      }
      const clamped = Math.max(SLIDER_MIN, n)
      setDraftMonths(String(clamped))
      onMonthsChanged(clamped)
    },
    [lookbackMonths, onMonthsChanged]
  )

  useEffect(() => {
    setDraftMonths(String(lookbackMonths))
  }, [lookbackMonths])

  const sliderMax = Math.max(SLIDER_BASE_MAX, lookbackMonths)
  const sliderValue = Math.min(Math.max(lookbackMonths, SLIDER_MIN), sliderMax)

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

      <View style={styles.controls}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('summary.lookback_label')}
          </Text>
          <Input
            className="w-16 min-h-10 px-2"
            style={styles.numberInput}
            value={draftMonths}
            keyboardType="number-pad"
            maxLength={4}
            selectTextOnFocus
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '')
              setDraftMonths(digits)
              if (digits.length > 0) {
                const n = parseInt(digits, 10)
                if (!Number.isNaN(n)) {
                  onMonthsChanged(Math.max(SLIDER_MIN, n))
                }
              }
            }}
            onEndEditing={() => commitMonths(draftMonths)}
            onBlur={() => commitMonths(draftMonths)}
          />
        </View>
        <View style={styles.sliderWrap}>
          <DesktopStyleSlider
            value={sliderValue}
            minimumValue={SLIDER_MIN}
            maximumValue={sliderMax}
            step={1}
            onPreviewChange={(v) => setDraftMonths(String(v))}
            onValueChange={onMonthsChanged}
          />
        </View>
      </View>

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

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1
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
  controls: {
    marginBottom: 24,
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
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  sliderWrap: {
    width: '100%',
    justifyContent: 'center',
    minHeight: 44
  },
  btn: {
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
