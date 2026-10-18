import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { WeatherEmoji } from '../WeatherIcon'
import { MoodEmoji } from '../MoodIcon/MoodEmoji'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

export interface DiaryMetaCardProps {
  weather?: string
  mood?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
  wordCount: number
}

export const DiaryMetaCard: React.FC<DiaryMetaCardProps> = ({
  weather,
  mood,
  tags,
  createdAt,
  updatedAt,
  wordCount
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.row}>
        {/* Weather & Mood */}
        <View style={styles.emojiGroup}>
          {weather ? <WeatherEmoji weather={weather} size={16} /> : null}
          {mood ? <MoodEmoji mood={mood} size={16} /> : null}
        </View>

        <View style={styles.dividerDot}>
          <View style={[styles.dot, { backgroundColor: colors.borderSubtle }]} />
        </View>

        {/* Dates */}
        <View style={styles.dateGroup}>
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>
              {t('diary.created', '创建')}
            </Text>
            <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
              {formatDate(createdAt)}
            </Text>
          </View>
          {createdAt !== updatedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>
                {t('diary.updated', '更新')}
              </Text>
              <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
                {formatDate(updatedAt)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.dividerDot}>
          <View style={[styles.dot, { backgroundColor: colors.borderSubtle }]} />
        </View>

        {/* Word Count */}
        <Text style={[styles.wordCount, { color: colors.textSecondary }]}>
          {wordCount}{' '}
          <Text style={[styles.wordUnit, { color: colors.textTertiary }]}>
            {t('diary.words', '字')}
          </Text>
        </Text>
      </View>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((tag, index) => (
            <View
              key={`${tag}-${index}`}
              style={[styles.tag, { backgroundColor: colors.primaryLight }]}
            >
              <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    padding: sharedTokens.spacing.mdTight
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  emojiGroup: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.xs
  },
  emoji: {
    fontSize: iconSizes.md
  },
  dividerDot: {
    paddingHorizontal: sharedTokens.spacing.sm
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: sharedTokens.radius.xxs
  },
  dateGroup: {
    flex: 1
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  dateLabel: {
    fontSize: mobileTypography.caption.fontSize
  },
  dateValue: {
    fontSize: mobileTypography.caption.fontSize
  },
  wordCount: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  wordUnit: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '400'
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.xs
  },
  tag: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.control
  },
  tagText: {
    fontSize: mobileTypography.caption.fontSize
  }
})
