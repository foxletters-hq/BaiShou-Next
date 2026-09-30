import React from 'react'
import { TouchableOpacity, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import {
  shouldShowPendingEmbed,
  shouldShowPendingExtract,
  type PendingEmbedCounts
} from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { diaryScreenStyles as styles } from './diary-screen.styles'

export function DiaryPendingStatusBar(props: {
  graphConfigured: boolean
  ragConfigured: boolean
  pendingGraphCount: number
  pendingEmbedCount: number
  pendingEmbedParts?: PendingEmbedCounts
  onPress?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()
  const { graphConfigured, ragConfigured, pendingGraphCount, pendingEmbedCount, onPress } = props

  const showExtract = shouldShowPendingExtract({
    graphConfigured,
    count: pendingGraphCount
  })
  const showEmbed = shouldShowPendingEmbed({
    ragConfigured,
    count: pendingEmbedCount
  })

  if (!showExtract && !showEmbed) {
    return null
  }

  const totalPending = (showExtract ? pendingGraphCount : 0) + (showEmbed ? pendingEmbedCount : 0)

  const handlePress = () => {
    if (onPress) {
      onPress()
      return
    }
    router.push({ pathname: '/memory', params: { tab: 'vectors' } })
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('diary.status_pending_organize', '待整理：{{count}} 项', {
        count: totalPending
      })}
      style={[
        styles.statusBar,
        { borderTopColor: colors.borderMuted, backgroundColor: colors.bgApp }
      ]}
    >
      <Text style={[styles.statusItem, { color: colors.textSecondary }]} numberOfLines={1}>
        {t('diary.status_pending_organize', '待整理：{{count}} 项', {
          count: totalPending
        })}
      </Text>
    </TouchableOpacity>
  )
}
