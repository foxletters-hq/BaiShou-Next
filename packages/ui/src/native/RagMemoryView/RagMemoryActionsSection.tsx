import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import type { RagState } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryActionsSectionProps {
  ragState: RagState
  onBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
  suspectCount?: number
  onReviewSuspects?: () => void
  showAdd?: boolean
  showReview?: boolean
}

export const RagMemoryActionsSection: React.FC<RagMemoryActionsSectionProps> = ({
  ragState,
  onBatchEmbed,
  onAddManualMemory,
  suspectCount = 0,
  onReviewSuspects,
  showAdd = true,
  showReview = true
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const progressPercent =
    ragState.total > 0 ? Math.round((ragState.progress / ragState.total) * 100) : 0
  const isBatchEmbedding = ragState.isRunning && ragState.type === 'batchEmbed'
  const showInlineProgress =
    ragState.isRunning && ragState.type !== 'reembed' && ragState.type !== 'migration'

  return (
    <View>
      {showInlineProgress && (
        <View style={styles.progressBox}>
          <Text style={[styles.statusText, { color: colors.textPrimary }]}>
            {ragState.statusText || t('common.processing')}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.bgSurfaceNormal }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${progressPercent}%`
                }
              ]}
            />
          </View>
          {ragState.total > 0 ? (
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {ragState.progress}/{ragState.total}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.actionRow}>
        {onBatchEmbed ? (
          <Button
            variant="outlined"
            size="sm"
            isDisabled={ragState.isRunning}
            onPress={() => void onBatchEmbed()}
          >
            {isBatchEmbedding
              ? `${t('common.processing')} ${ragState.progress}/${ragState.total}`
              : t('settings.rag_batch_embed', '开始索引')}
          </Button>
        ) : null}
        {showAdd && onAddManualMemory ? (
          <Button
            variant="outlined"
            size="sm"
            isDisabled={ragState.isRunning}
            onPress={() => void onAddManualMemory()}
          >
            {t('settings.rag_add_manual', '添加片段')}
          </Button>
        ) : null}
        {showReview && onReviewSuspects ? (
          <Button variant="outlined" size="sm" onPress={onReviewSuspects}>
            {suspectCount > 0
              ? t('memory.review_suspects_toolbar_count', '检查待确认节点 ({{count}})', {
                  count: suspectCount
                })
              : t('memory.review_suspects_toolbar', '检查待确认节点')}
          </Button>
        ) : null}
      </View>
    </View>
  )
}
