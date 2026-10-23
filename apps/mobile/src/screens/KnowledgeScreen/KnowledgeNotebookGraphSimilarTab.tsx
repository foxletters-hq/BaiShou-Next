import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'

export function KnowledgeNotebookGraphSimilarTab(props: {
  similarPairs: GraphSimilarPendingPair[]
  reviewBusy: boolean
  onLocateNode: (nodeId: string) => void
  onMergeSimilar: (pair: GraphSimilarPendingPair) => void
  onDismissSimilar: (pair: GraphSimilarPendingPair) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  if (props.similarPairs.length === 0) {
    return (
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: mobileTypography.secondary.fontSize
        }}
      >
        {t('graph.no_similar_pending', '没有相似待合并')}
      </Text>
    )
  }

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      {props.similarPairs.map((pair) => (
        <Card key={`${pair.nodeId}:${pair.peerId}`}>
          <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm }}>
            <View style={{ gap: tokens.spacing.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.sm
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.primary.fontSize,
                    flex: 1
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>
                    {t('graph.similar_node_1', '节点1：')}
                  </Text>
                  <Text style={{ fontWeight: mobileTypography.primary.fontWeight }}>
                    {pair.nodeName}
                  </Text>
                </Text>
                <Button
                  size="sm"
                  variant="outlined"
                  onPress={() => props.onLocateNode(pair.nodeId)}
                >
                  {t('graph.locate', '查看')}
                </Button>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.sm
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.primary.fontSize,
                    flex: 1
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>
                    {t('graph.similar_node_2', '节点2：')}
                  </Text>
                  <Text style={{ fontWeight: mobileTypography.primary.fontWeight }}>
                    {pair.peerName}
                  </Text>
                </Text>
                <Button
                  size="sm"
                  variant="outlined"
                  onPress={() => props.onLocateNode(pair.peerId)}
                >
                  {t('graph.locate', '查看')}
                </Button>
              </View>
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize
              }}
            >
              {pair.reason || t('graph.similar_pending', '相似待合并')}
            </Text>
            <View style={[modalActionsStyle, { marginTop: 0 }]}>
              <Button
                size="sm"
                isDisabled={props.reviewBusy}
                onPress={() => void props.onMergeSimilar(pair)}
              >
                {t('graph.merge', '合并')}
              </Button>
              <Button
                size="sm"
                variant="outlined"
                isDisabled={props.reviewBusy}
                onPress={() => void props.onDismissSimilar(pair)}
              >
                {t('graph.keep_apart', '分开保留')}
              </Button>
            </View>
          </View>
        </Card>
      ))}
    </View>
  )
}
