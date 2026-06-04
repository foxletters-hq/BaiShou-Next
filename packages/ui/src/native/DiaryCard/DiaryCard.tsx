import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../../native/theme'
import {
  normalizeWeatherId,
  weatherI18nKey,
  WEATHER_IDS,
  formatDiaryPreviewText
} from '@baishou/shared'
import type { WeatherId } from '@baishou/shared'
import { WeatherEmoji } from '../WeatherIcon'

interface DiaryCardProps {
  id: number
  contentSnippet: string
  tags: string[]
  createdAt: Date
  weather?: string
  mood?: string
  location?: string
  isFavorite?: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export const DiaryCard: React.FC<DiaryCardProps> = ({
  id,
  contentSnippet,
  tags,
  createdAt,
  weather,
  mood,
  location,
  isFavorite,
  onClick,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const day = createdAt.getDate().toString().padStart(2, '0')
  const month = createdAt.getMonth() + 1
  const year = createdAt.getFullYear()
  const weekdayKeys = [
    'diary.weekday_sun',
    'diary.weekday_mon',
    'diary.weekday_tue',
    'diary.weekday_wed',
    'diary.weekday_thu',
    'diary.weekday_fri',
    'diary.weekday_sat'
  ] as const
  const weekday = t(weekdayKeys[createdAt.getDay()])

  const weatherLabel = (() => {
    if (!weather) return ''
    const id = normalizeWeatherId(weather)
    if ((WEATHER_IDS as readonly string[]).includes(id)) {
      return t(`diary.weather.${weatherI18nKey(id as WeatherId)}`)
    }
    return weather
  })()

  const getTagColor = (tag: string) => {
    // 使用主题颜色，确保深浅模式下对比度一致
    const tagColors = [
      { bg: colors.accentBlue + '15', fg: colors.accentBlue },
      { bg: colors.accentGreen + '15', fg: colors.accentGreen },
      { bg: colors.warning + '15', fg: colors.warning },
      { bg: colors.accentPurple + '15', fg: colors.accentPurple }
    ]
    let sum = 0
    for (let i = 0; i < tag.length; i++) sum += tag.charCodeAt(i)
    return tagColors[sum % tagColors.length]!
  }

  const previewText = formatDiaryPreviewText(contentSnippet)

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}
      onPress={onClick}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={styles.dateGroup}>
          <Text style={[styles.day, { color: colors.textPrimary }]}>{day}</Text>
          <View style={styles.dateMeta}>
            <Text style={[styles.weekday, { color: colors.textSecondary }]}>{weekday}</Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary
                }
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {year} · {month}
                {t('diary.month_suffix')}
              </Text>
            </View>
          </View>
        </View>
        {isFavorite ? (
          <MaterialIcons name="favorite" size={22} color={colors.warning} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* 元数据行：天气、心情、位置 */}
      {(weather || mood || location) && (
        <View style={styles.metaRow}>
          {weather && (
            <View style={[styles.metaBadge, { backgroundColor: colors.bgSurfaceHighest }]}>
              <View style={styles.metaWeatherRow}>
                <WeatherEmoji weather={weather} size={16} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {weatherLabel}
                </Text>
              </View>
            </View>
          )}
          {mood && (
            <View style={[styles.metaBadge, { backgroundColor: colors.bgSurfaceHighest }]}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>😊 {mood}</Text>
            </View>
          )}
          {location && (
            <View style={[styles.metaBadge, { backgroundColor: colors.bgSurfaceHighest }]}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>📍 {location}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.contentContainer}>
        <Text style={[styles.snippet, { color: colors.textPrimary }]} numberOfLines={5}>
          {previewText}
        </Text>
        {/* RN LinearGradient mask typically requires react-native-linear-gradient, mock with simple overlap or fade */}
      </View>

      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => {
            const { bg, fg } = getTagColor(tag)
            return (
              <View key={tag} style={[styles.tag, { backgroundColor: bg }]}>
                <Text style={[styles.tagText, { color: fg }]}>#{tag}</Text>
              </View>
            )
          })}
        </View>
      )}

      {/* On Mobile we always show the action buttons according to the original code "Builder isMobile" logic */}
      <View style={[styles.actionsDivider, { backgroundColor: colors.borderMuted }]} />
      <View style={styles.actionsBox}>
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
          <Text style={[styles.editText, { color: colors.textSecondary }]}>{t('common.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
          <Text style={[styles.deleteText, { color: colors.error }]}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }
    }),
    marginBottom: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20
  },
  dateGroup: { flexDirection: 'row', alignItems: 'center' },
  day: { fontSize: 32, fontWeight: '800', lineHeight: 32 },
  dateMeta: { marginLeft: 12, justifyContent: 'center' },
  weekday: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  badge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  headerSpacer: { width: 22 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  metaWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaText: { fontSize: 12 },
  contentContainer: { maxHeight: 120, overflow: 'hidden' },
  snippet: { fontSize: 15, lineHeight: 24, opacity: 0.9 },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    gap: 8
  },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '600' },
  actionsDivider: { height: 1, marginTop: 20, marginBottom: 12 },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  editText: { fontSize: 13, fontWeight: '600' },
  deleteText: { fontSize: 13, fontWeight: '600' }
})
