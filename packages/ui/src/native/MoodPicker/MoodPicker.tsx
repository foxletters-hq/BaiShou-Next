import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react-native'
import {
  MOOD_IDS,
  getMoodLabelFallback,
  moodI18nKey,
  normalizeMoodId,
  type MoodId
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { MoodEmoji } from '../MoodIcon/MoodEmoji'

export interface NativeMoodPickerProps {
  value: string
  onChange: (value: string) => void
}

const TRIGGER_HEIGHT = 38
const ICON_SIZE = 18

export const MoodPicker: React.FC<NativeMoodPickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [open, setOpen] = useState(false)

  const selectedId = normalizeMoodId(value)
  const isKnownMood = selectedId && (MOOD_IDS as readonly string[]).includes(selectedId)
  const displayLabel = isKnownMood
    ? t(
        `diary.mood.${moodI18nKey(selectedId as MoodId)}`,
        getMoodLabelFallback(selectedId as MoodId)
      )
    : t('diary.mood.default', '心情')

  const close = useCallback(() => setOpen(false), [])

  const handleSelect = (id: MoodId | '') => {
    onChange(id)
    close()
  }

  const panelWidth = Math.min(screenWidth - 48, 320)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            opacity: pressed ? 0.9 : 1,
            backgroundColor: colors.bgSurface,
            borderColor: open || isKnownMood ? colors.primary : colors.borderSubtle,
            shadowColor: open ? colors.primary : 'transparent',
            ...(open
              ? {
                  borderWidth: 1.5,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  elevation: 3
                }
              : { borderWidth: 1 })
          }
        ]}
      >
        <View style={styles.triggerContent}>
          {isKnownMood ? <MoodEmoji mood={selectedId} size={ICON_SIZE} /> : null}
          <Text
            style={[
              styles.triggerLabel,
              { color: isKnownMood ? colors.textPrimary : colors.textSecondary }
            ]}
            numberOfLines={1}
          >
            {displayLabel}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]}
            onPress={close}
          />
          <View
            style={[
              styles.dropdownPanel,
              {
                width: panelWidth,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: tokens.radius.lg
              }
            ]}
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {MOOD_IDS.map((id) => {
                const active = selectedId === id
                const label = t(`diary.mood.${moodI18nKey(id)}`, getMoodLabelFallback(id))
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleSelect(active ? '' : id)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      {
                        opacity: pressed ? 0.85 : 1,
                        backgroundColor: active ? colors.primaryLight : 'transparent'
                      }
                    ]}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                  >
                    <MoodEmoji mood={id} size={ICON_SIZE} />
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: active ? colors.primary : colors.textPrimary }
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    {active ? (
                      <Check size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                    ) : (
                      <View style={styles.checkPlaceholder} />
                    )}
                  </Pressable>
                )
              })}
            </ScrollView>
            <Pressable
              onPress={() => handleSelect('')}
              style={[
                styles.clearBtn,
                { backgroundColor: colors.bgSurfaceHighest, borderTopColor: colors.borderSubtle }
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {t('diary.clear_filter')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    maxWidth: 176,
    height: TRIGGER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 16
  },
  chevron: {
    fontSize: 10,
    lineHeight: 12
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  dropdownPanel: {
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 1,
    maxHeight: '70%'
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: TRIGGER_HEIGHT,
    paddingHorizontal: 14
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18
  },
  checkPlaceholder: {
    width: 18
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1
  }
})
