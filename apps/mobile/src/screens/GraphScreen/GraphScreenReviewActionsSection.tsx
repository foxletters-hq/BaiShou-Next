import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { graphInventoryReviewCount } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Badge, Button, Card, useNativeTheme } from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import { graphScreenSectionStyles as styles } from './graph-screen-section.styles'

export function GraphScreenReviewActionsSection(props: {
  pendingCount: number
  similarCount: number
  reextractCount: number
  onOpenReview: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const reviewCount = graphInventoryReviewCount({
    pendingCount: props.pendingCount,
    similarCount: props.similarCount,
    reextractCount: props.reextractCount
  })

  return (
    <Card
      style={[
        styles.card,
        {
          marginTop: sharedTokens.spacing.sm
        }
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm,
          minWidth: 0
        }}
      >
        <Text
          style={[
            styles.hint,
            {
              color: colors.textSecondary,
              flexShrink: 0
            }
          ]}
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
      {reviewCount > 0 ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('graph.node_review_open_hint', '点击可打开整理页处理待确认、相似和待重抽的节点。')}
        </Text>
      ) : null}
    </Card>
  )
}
