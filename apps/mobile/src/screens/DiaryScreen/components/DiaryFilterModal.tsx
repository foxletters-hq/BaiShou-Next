import React from 'react'
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { X, Heart, Check } from 'lucide-react-native'
import {
  WEATHER_IDS,
  weatherI18nKey,
  MOOD_IDS,
  moodI18nKey,
  getMoodLabelFallback,
  type WeatherId,
  type MoodId
} from '@baishou/shared'
import { useNativeTheme, WeatherEmoji, MoodEmoji } from '@baishou/ui/native'
import { diaryAppBarStyles as styles } from './DiaryAppBar.styles'

export interface DiaryFilterModalProps {
  visible: boolean
  onClose: () => void
  filterWeathers: string[]
  onFilterWeathersChange: (weathers: string[]) => void
  filterMoods: string[]
  onFilterMoodsChange: (moods: string[]) => void
  filterFavorite: boolean
  onFilterFavoriteChange: (v: boolean) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export const DiaryFilterModal: React.FC<DiaryFilterModalProps> = ({
  visible,
  onClose,
  filterWeathers,
  onFilterWeathersChange,
  filterMoods,
  onFilterMoodsChange,
  filterFavorite,
  onFilterFavoriteChange,
  hasActiveFilters,
  onClearFilters
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const getWeatherLabel = (id: WeatherId) => t(`diary.weather.${weatherI18nKey(id)}`, id)
  const getMoodLabel = (id: MoodId) => t(`diary.mood.${moodI18nKey(id)}`, getMoodLabelFallback(id))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.filterPanel, { backgroundColor: colors.bgSurface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.filterHeader, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.filterTitle, { color: colors.textPrimary }]}>
              {t('diary.filter')}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={onClearFilters} style={styles.clearBtn}>
                <X size={14} color={colors.textTertiary} strokeWidth={2} />
                <Text style={[styles.clearText, { color: colors.textTertiary }]}>
                  {t('diary.clear_filter')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.filterBody} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterOption,
                filterFavorite && { backgroundColor: colors.primaryLight }
              ]}
              onPress={() => onFilterFavoriteChange(!filterFavorite)}
            >
              <Heart
                size={18}
                color={filterFavorite ? colors.warning : colors.textPrimary}
                fill={filterFavorite ? colors.warning : 'transparent'}
                strokeWidth={2}
              />
              <Text style={[styles.filterOptionText, { color: colors.textPrimary }]}>
                {t('diary.filter_favorite')}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.filterSectionLabel, { color: colors.textTertiary }]}>
              {t('diary.filter_weather')}
            </Text>
            <View style={styles.weatherList}>
              {WEATHER_IDS.map((weather) => {
                const active = filterWeathers.includes(weather)
                const label = getWeatherLabel(weather)
                return (
                  <TouchableOpacity
                    key={weather}
                    style={[
                      styles.weatherOption,
                      active && { backgroundColor: colors.primaryLight }
                    ]}
                    onPress={() =>
                      onFilterWeathersChange(
                        active
                          ? filterWeathers.filter((w) => w !== weather)
                          : [...filterWeathers, weather]
                      )
                    }
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                  >
                    <WeatherEmoji weather={weather} size={22} />
                    <Text
                      style={[
                        styles.weatherOptionLabel,
                        { color: active ? colors.primary : colors.textPrimary }
                      ]}
                    >
                      {label}
                    </Text>
                    {active ? (
                      <Check size={18} color={colors.primary} strokeWidth={2} />
                    ) : (
                      <View style={styles.weatherCheckPlaceholder} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={[styles.filterSectionLabel, { color: colors.textTertiary }]}>
              {t('diary.filter_mood')}
            </Text>
            <View style={styles.weatherList}>
              {MOOD_IDS.map((mood) => {
                const active = filterMoods.includes(mood)
                const label = getMoodLabel(mood)
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[
                      styles.weatherOption,
                      active && { backgroundColor: colors.primaryLight }
                    ]}
                    onPress={() =>
                      onFilterMoodsChange(
                        active ? filterMoods.filter((m) => m !== mood) : [...filterMoods, mood]
                      )
                    }
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                  >
                    <MoodEmoji mood={mood} size={22} />
                    <Text
                      style={[
                        styles.weatherOptionLabel,
                        { color: active ? colors.primary : colors.textPrimary }
                      ]}
                    >
                      {label}
                    </Text>
                    {active ? (
                      <Check size={18} color={colors.primary} strokeWidth={2} />
                    ) : (
                      <View style={styles.weatherCheckPlaceholder} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.filterDoneBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.filterDoneText, { color: colors.textOnPrimary }]}>
              {t('common.done')}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
