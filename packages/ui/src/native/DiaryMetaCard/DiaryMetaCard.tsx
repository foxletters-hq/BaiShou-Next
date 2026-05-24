import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface DiaryMetaCardProps {
  weather?: string
  mood?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
  wordCount: number
}

const weatherEmojiMap: Record<string, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  snowy: '❄️',
  windy: '💨',
  foggy: '🌫️',
  stormy: '⛈️'
}

const moodEmojiMap: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  excited: '🤩',
  calm: '😌',
  anxious: '😰',
  angry: '😠',
  grateful: '🙏',
  tired: '😴'
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

  const weatherEmoji = weather ? weatherEmojiMap[weather] || '🌤️' : null
  const moodEmoji = mood ? moodEmojiMap[mood] || '😶' : null

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
          {weatherEmoji && <Text style={styles.emoji}>{weatherEmoji}</Text>}
          {moodEmoji && <Text style={styles.emoji}>{moodEmoji}</Text>}
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  emojiGroup: {
    flexDirection: 'row',
    gap: 4
  },
  emoji: {
    fontSize: 20
  },
  dividerDot: {
    paddingHorizontal: 8
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2
  },
  dateGroup: {
    flex: 1
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dateLabel: {
    fontSize: 11
  },
  dateValue: {
    fontSize: 11
  },
  wordCount: {
    fontSize: 13,
    fontWeight: '600'
  },
  wordUnit: {
    fontSize: 11,
    fontWeight: '400'
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 4
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  tagText: {
    fontSize: 12
  }
})
