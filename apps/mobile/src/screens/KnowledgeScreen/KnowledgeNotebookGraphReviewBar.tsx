import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Badge, Button, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { notebookGraphReviewCount } from './knowledge-notebook-graph.util'

export function KnowledgeNotebookGraphReviewBar(props: {
  pendingNodeCount: number
  pendingEdgeCount: number
  similarPairCount: number
  onOpenReview: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const reviewCount = notebookGraphReviewCount({
    pendingNodeCount: props.pendingNodeCount,
    pendingEdgeCount: props.pendingEdgeCount,
    similarPairCount: props.similarPairCount
  })

  return (
    <View
      style={[
        styles.sectionLabelRow,
        { justifyContent: 'space-between', gap: tokens.spacing.sm, minWidth: 0 }
      ]}
    >
      <Text
        style={{
          color: colors.textSecondary,
          flexShrink: 0,
          fontSize: mobileTypography.secondary.fontSize
        }}
      >
        {t('graph.node_review_status', '节点整理状态：')}
      </Text>
      {reviewCount === 0 ? (
        <Text
          style={{
            color: colors.textSecondary,
            flex: 1,
            minWidth: 0,
            textAlign: 'right',
            fontSize: mobileTypography.secondary.fontSize
          }}
          numberOfLines={1}
        >
          {t('graph.node_review_ready', '全部就绪')}
        </Text>
      ) : (
        <View style={{ flexShrink: 0, overflow: 'visible' }}>
          <Button size="sm" variant="outlined" onPress={props.onOpenReview}>
            {t('graph.node_review_needed', '有需要整理的节点')}
          </Button>
          <View
            style={{
              position: 'absolute',
              top: -tokens.spacing.xs,
              right: -tokens.spacing.xs
            }}
            pointerEvents="none"
          >
            <Badge count={reviewCount} />
          </View>
        </View>
      )}
    </View>
  )
}
