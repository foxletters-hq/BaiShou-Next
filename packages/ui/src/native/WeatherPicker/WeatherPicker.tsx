import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  WEATHER_IDS,
  getWeatherEmoji,
  weatherI18nKey,
  type WeatherId
} from '@baishou/shared'
import { useNativeTheme } from '../theme'

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
    ? `${getWeatherEmoji(selectedId)} ${t(`diary.weather.${weatherI18nKey(selectedId as WeatherId)}`, weatherLabelFallback[selectedId as WeatherId])}`
    : t('diary.weather.default')

  const close = useCallback(() => setOpen(false), [])

  const handleSelect = (id: WeatherId | '') => {
    onChange(id)
    close()
  }

  const mosaicWidth = Math.min(screenWidth - 48, 340)
  const cellSize = (mosaicWidth - 16 * 2 - 8 * 3) / 4

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
        <Text style={[styles.triggerLabel, { color: selectedId ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
          {displayLabel}
        </Text>
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.bgOverlay }]} onPress={close}>
          <Pressable
            style={[
              styles.mosaicPanel,
              {
                width: mosaicWidth,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: tokens.radius.lg
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>
              {t('diary.weather_label')}
            </Text>
            <View style={styles.mosaicGrid}>
              {WEATHER_IDS.map((id) => {
                const active = selectedId === id
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleSelect(active ? '' : id)}
                    style={({ pressed }) => [
                      styles.mosaicCell,
                      {
                        width: cellSize,
                        height: cellSize,
                        opacity: pressed ? 0.85 : 1,
                        backgroundColor: active ? colors.primaryLight : colors.bgSurfaceHighest,
                        borderColor: active ? colors.primary : colors.borderSubtle
                      }
                    ]}
                    accessibilityLabel={t(
                      `diary.weather.${weatherI18nKey(id)}`,
                      weatherLabelFallback[id]
                    )}
                  >
                    <Text style={styles.mosaicEmoji}>{getWeatherEmoji(id)}</Text>
                    <Text
                      style={[
                        styles.mosaicLabel,
                        { color: active ? colors.primary : colors.textSecondary }
                      ]}
                      numberOfLines={1}
                    >
                      {t(`diary.weather.${weatherI18nKey(id)}`, weatherLabelFallback[id])}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable
              onPress={() => handleSelect('')}
              style={[styles.clearBtn, { backgroundColor: colors.bgSurfaceHighest }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('diary.clear_filter')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
  mosaicPanel: {
    padding: 16,
    borderWidth: 1,
    gap: 12
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center'
  },
  mosaicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center'
  },
  mosaicCell: {
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 2
  },
  mosaicEmoji: {
    fontSize: 22,
    lineHeight: 26
  },
  mosaicLabel: {
    fontSize: 10,
    fontWeight: '600'
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8
  }
})
