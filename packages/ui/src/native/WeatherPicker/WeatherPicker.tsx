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
import { MaterialIcons } from '@expo/vector-icons'
import { WEATHER_IDS, weatherI18nKey, type WeatherId } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { WeatherEmoji } from '../WeatherIcon'

export interface NativeWeatherPickerProps {
  value: string
  onChange: (value: string) => void
}

const weatherLabelFallback: Record<WeatherId, string> = {
  sunny: '晴',
  cloudy: '多云',
  overcast: '阴',
  light_rain: '小雨',
  heavy_rain: '大雨',
  snow: '雪',
  fog: '雾',
  windy: '风'
}

export const WeatherPicker: React.FC<NativeWeatherPickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [open, setOpen] = useState(false)

  const selectedId = value && (WEATHER_IDS as readonly string[]).includes(value) ? value : ''
  const displayLabel = selectedId
    ? t(
        `diary.weather.${weatherI18nKey(selectedId as WeatherId)}`,
        weatherLabelFallback[selectedId as WeatherId]
      )
    : t('diary.weather.default')

  const close = useCallback(() => setOpen(false), [])

  const handleSelect = (id: WeatherId | '') => {
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
            borderColor: open || selectedId ? colors.primary : colors.borderSubtle,
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
          {selectedId ? <WeatherEmoji weather={selectedId} size={18} /> : null}
          <Text
            style={[
              styles.triggerLabel,
              { color: selectedId ? colors.textPrimary : colors.textSecondary }
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
              {WEATHER_IDS.map((id) => {
                const active = selectedId === id
                const label = t(`diary.weather.${weatherI18nKey(id)}`, weatherLabelFallback[id])
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
                    <WeatherEmoji weather={id} size={22} />
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
                      <MaterialIcons name="check" size={18} color={colors.primary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1
  },
  chevron: {
    fontSize: 10
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
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500'
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
