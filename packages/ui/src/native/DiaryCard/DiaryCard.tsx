import { useTranslation } from 'react-i18next'
import React, { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../../native/theme'
import {
  formatDiaryPreviewText,
  getDiaryTagColorIndex,
  limitDiaryPreviewTags,
  resolveDiaryTagColorIndex,
  resolveWeatherId,
  type DiaryTagColorRegistry
} from '@baishou/shared'
import { WeatherEmoji } from '../WeatherIcon'
import { MoodEmoji } from '../MoodIcon/MoodEmoji'

interface DiaryCardProps {
  id: number
  contentSnippet: string
  tags: string[]
  createdAt: Date
  weather?: string
  mood?: string
  isFavorite?: boolean
  /** 语义搜索相似度 0–1 */
  matchSimilarity?: number
  tagColorRegistry?: DiaryTagColorRegistry
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export const DiaryCard: React.FC<DiaryCardProps> = memo(function DiaryCard({
  id,
  contentSnippet,
  tags,
  createdAt,
  weather,
  mood,
  isFavorite,
  matchSimilarity,
  tagColorRegistry,
  onClick,
  onEdit,
  onDelete
}: DiaryCardProps) {
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

  const tagPalette = [
    { bg: colors.accentBlue + '15', fg: colors.accentBlue },
    { bg: colors.accentGreen + '15', fg: colors.accentGreen },
    { bg: colors.warning + '15', fg: colors.warning },
    { bg: colors.accentPurple + '15', fg: colors.accentPurple }
  ]

  const getTagColor = (tag: string) => {
    const index = resolveDiaryTagColorIndex(tag, tagColorRegistry)
    return tagPalette[index] ?? tagPalette[getDiaryTagColorIndex(tag)]!
  }

  const previewText = formatDiaryPreviewText(contentSnippet)
  const { visibleTags: previewTags, overflowCount: tagOverflowCount } = limitDiaryPreviewTags(tags)

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
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: 'transparent',
                    borderColor: colors.primary
                  }
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {year} · {month}
                  {t('diary.month_suffix')}
                </Text>
              </View>
              {weather && resolveWeatherId(weather) ? (
                <View
                  style={[
                    styles.iconOutlineBadge,
                    { borderColor: colors.primary, backgroundColor: 'transparent' }
                  ]}
                >
                  <WeatherEmoji weather={weather} size={14} />
                </View>
              ) : null}
              {mood ? (
                <View
                  style={[
                    styles.iconOutlineBadge,
                    { borderColor: colors.primary, backgroundColor: 'transparent' }
                  ]}
                >
                  <MoodEmoji mood={mood} size={14} />
                </View>
              ) : null}
              {matchSimilarity != null && (
                <View style={[styles.similarityBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.similarityText, { color: colors.primary }]}>
                    {(matchSimilarity * 100).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {isFavorite ? (
          <MaterialIcons name="favorite" size={22} color={colors.warning} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.snippet, { color: colors.textPrimary }]} numberOfLines={5}>
          {previewText}
        </Text>
        {/* RN LinearGradient mask typically requires react-native-linear-gradient, mock with simple overlap or fade */}
      </View>

      {previewTags.length > 0 && (
        <View style={styles.tagsContainer}>
          {previewTags.map((tag) => {
            const { bg, fg } = getTagColor(tag)
            return (
              <View key={tag} style={[styles.tag, { backgroundColor: bg }]}>
                <Text style={[styles.tagText, { color: fg }]}>#{tag}</Text>
              </View>
            )
          })}
          {tagOverflowCount > 0 ? (
            <View style={[styles.tag, { backgroundColor: colors.bgSurfaceHighest }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                +{tagOverflowCount}
              </Text>
            </View>
          ) : null}
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
})

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'solid'
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  iconOutlineBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  similarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  similarityText: {
    fontSize: 10,
    fontWeight: '800'
  },
  headerSpacer: { width: 22 },
  contentContainer: { maxHeight: 120, overflow: 'hidden' },
  snippet: { fontSize: 15, lineHeight: 24, opacity: 0.9 },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    gap: 8,
    maxHeight: 52,
    overflow: 'hidden'
  },
  tag: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagText: { fontSize: 12, fontWeight: '600', lineHeight: 12 },
  actionsDivider: { height: 1, marginTop: 20, marginBottom: 12 },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  editText: { fontSize: 13, fontWeight: '600' },
  deleteText: { fontSize: 13, fontWeight: '600' }
})
