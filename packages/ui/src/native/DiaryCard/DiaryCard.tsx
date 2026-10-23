import { useTranslation } from 'react-i18next'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { Heart } from 'lucide-react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../../native/theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import {
  getDiaryTagColorIndex,
  limitDiaryPreviewTags,
  prepareDiaryCardPreviewMarkdown,
  resolveDiaryTagColorIndex,
  resolveWeatherId,
  resolveMoodId,
  type DiaryTagColorRegistry
} from '@baishou/shared'
import { WeatherEmoji } from '../WeatherIcon'
import { MoodEmoji } from '../MoodIcon/MoodEmoji'
import { MarkdownRenderer } from '../MarkdownRenderer'

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

const MAX_CONTENT_HEIGHT = 120
const FADE_HEIGHT = 40
const TRUNCATE_CHAR_THRESHOLD = 50
const TRUNCATE_HEIGHT_THRESHOLD = 95

export const DiaryCard: React.FC<DiaryCardProps> = memo(function DiaryCard({
  id: _id,
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

  const gradientId = useMemo(() => `diary-card-fade-${_id ?? '0'}`, [_id])

  const isLikelyTruncated = useMemo(() => {
    if (!contentSnippet) return false
    return (
      contentSnippet.length > TRUNCATE_CHAR_THRESHOLD ||
      (contentSnippet.match(/\n/g) || []).length >= 2
    )
  }, [contentSnippet])

  const [isTruncated, setIsTruncated] = useState(isLikelyTruncated)

  useEffect(() => {
    setIsTruncated(isLikelyTruncated)
  }, [isLikelyTruncated])

  const handleContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height
      const truncated =
        height >= TRUNCATE_HEIGHT_THRESHOLD ||
        (contentSnippet?.length ?? 0) > TRUNCATE_CHAR_THRESHOLD ||
        (contentSnippet?.match(/\n/g) || []).length >= 2
      setIsTruncated((prev) => (prev !== truncated ? truncated : prev))
    },
    [contentSnippet]
  )

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

  const previewMarkdown = useMemo(() => {
    const text = prepareDiaryCardPreviewMarkdown(contentSnippet)
    if (!text) return ''
    return text.length > 500 ? `${text.slice(0, 500)}…` : text
  }, [contentSnippet])
  const { visibleTags: previewTags, overflowCount: tagOverflowCount } = limitDiaryPreviewTags(tags)

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}
      onPress={() => onClick?.()}
      activeOpacity={0.9}
      disallowInterruption
    >
      <View style={styles.header}>
        <View style={styles.dateGroup}>
          <Text style={[styles.day, { color: colors.textPrimary }]} selectable={false}>
            {day}
          </Text>
          <View style={styles.dateMeta}>
            <Text style={[styles.weekday, { color: colors.textSecondary }]} selectable={false}>
              {weekday}
            </Text>
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
                <Text style={[styles.badgeText, { color: colors.primary }]} selectable={false}>
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
              {resolveMoodId(mood) ? (
                <View
                  style={[
                    styles.iconOutlineBadge,
                    { borderColor: colors.primary, backgroundColor: 'transparent' }
                  ]}
                >
                  <MoodEmoji mood={mood ?? ''} size={14} />
                </View>
              ) : null}
              {matchSimilarity != null && (
                <View style={[styles.similarityBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text
                    style={[styles.similarityText, { color: colors.primary }]}
                    selectable={false}
                  >
                    {(matchSimilarity * 100).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {isFavorite ? (
          <Heart
            size={22}
            color={colors.warning}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            fill={colors.warning}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.contentContainer} pointerEvents="box-none">
        <View onLayout={handleContentLayout} pointerEvents="box-none">
          {previewMarkdown ? (
            <MarkdownRenderer content={previewMarkdown} variant="preview" />
          ) : (
            <Text
              style={[styles.snippet, { color: colors.textSecondary }]}
              numberOfLines={3}
              selectable={false}
            >
              —
            </Text>
          )}
        </View>
        {isTruncated ? (
          <View testID="diary-card-fade-gradient" style={styles.gradientFade} pointerEvents="none">
            <Svg width="100%" height={FADE_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.bgSurface} stopOpacity="0" />
                  <Stop offset="40%" stopColor={colors.bgSurface} stopOpacity="0.05" />
                  <Stop offset="70%" stopColor={colors.bgSurface} stopOpacity="0.45" />
                  <Stop offset="100%" stopColor={colors.bgSurface} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
            </Svg>
          </View>
        ) : null}
      </View>

      {previewTags.length > 0 && (
        <View style={styles.tagsContainer}>
          {previewTags.map((tag) => {
            const { bg, fg } = getTagColor(tag)
            return (
              <View key={tag} style={[styles.tag, { backgroundColor: bg }]}>
                <Text style={[styles.tagText, { color: fg }]} selectable={false}>
                  #{tag}
                </Text>
              </View>
            )
          })}
          {tagOverflowCount > 0 ? (
            <View style={[styles.tag, { backgroundColor: colors.bgSurfaceHighest }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]} selectable={false}>
                +{tagOverflowCount}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* On Mobile we always show the action buttons according to the original code "Builder isMobile" logic */}
      <View style={[styles.actionsDivider, { backgroundColor: colors.borderMuted }]} />
      <View style={styles.actionsBox}>
        <TouchableOpacity
          onPress={onEdit}
          style={styles.actionBtn}
          activeOpacity={0.7}
          disallowInterruption
        >
          <Text style={[styles.editText, { color: colors.textSecondary }]} selectable={false}>
            {t('common.edit')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={styles.actionBtn}
          activeOpacity={0.7}
          disallowInterruption
        >
          <Text style={[styles.deleteText, { color: colors.error }]} selectable={false}>
            {t('common.delete')}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    borderRadius: sharedTokens.radius.lg,
    padding: sharedTokens.spacing.md,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: sharedTokens.spacing.mdPlus
  },
  dateGroup: { flexDirection: 'row', alignItems: 'center' },
  day: {
    fontSize: mobileTypography.display.fontSize,
    fontWeight: mobileTypography.display.fontWeight,
    lineHeight: mobileTypography.display.lineHeight
  },
  dateMeta: { marginLeft: sharedTokens.spacing.mdTight, justifyContent: 'center' },
  weekday: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    letterSpacing: 0.5
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.sm
  },
  badge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs,
    borderWidth: 0.5
  },
  badgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight,
    letterSpacing: 0.5
  },
  iconOutlineBadge: {
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  similarityBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  similarityText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight
  },
  headerSpacer: { width: 22 },
  contentContainer: {
    maxHeight: MAX_CONTENT_HEIGHT,
    overflow: 'hidden',
    position: 'relative'
  },
  gradientFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT
  },
  snippet: {
    fontSize: mobileTypography.body.fontSize,
    lineHeight: mobileTypography.body.lineHeight,
    opacity: 0.9
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: sharedTokens.spacing.mdPlus,
    gap: sharedTokens.spacing.sm,
    maxHeight: 52,
    overflow: 'hidden'
  },
  tag: {
    flexDirection: 'row',
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.sm,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight,
    lineHeight: mobileTypography.caption.fontSize
  },
  actionsDivider: {
    height: 1,
    marginTop: sharedTokens.spacing.mdPlus,
    marginBottom: sharedTokens.spacing.mdTight
  },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', gap: sharedTokens.spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: sharedTokens.spacing.sm },
  editText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  deleteText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  }
})
