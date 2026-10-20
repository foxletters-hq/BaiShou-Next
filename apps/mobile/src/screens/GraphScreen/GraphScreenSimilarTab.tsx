import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'
import { sharedTokens } from '@baishou/ui/theme/tokens'

export function GraphScreenSimilarTab(props: {
  pairs: GraphSimilarPendingPair[]
  busy: boolean
  onMerge: (pair: GraphSimilarPendingPair) => void
  onKeepApart: (pair: GraphSimilarPendingPair) => void
  onLocateNode: (id: string) => void
  listPad: { padding: number; paddingBottom: number }
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  if (props.pairs.length === 0) {
    return (
      <View style={[styles.pendingPane, props.listPad]}>
        <Text style={{ color: colors.textSecondary }}>
          {t('graph.similar_empty', '没有需要你决定是否合并的相似节点')}
        </Text>
      </View>
    )
  }
  return (
    <ScrollView style={styles.pendingPane} contentContainerStyle={props.listPad}>
      <View
        style={[
          styles.pendingHintBox,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderControl,
            marginBottom: sharedTokens.spacing.md
          }
        ]}
      >
        <Text style={[styles.pendingHintText, { color: colors.textSecondary }]}>
          {t(
            'graph.similar_hint',
            '以下节点名称或语义相近，请确认是否指向同一对象；若相同可合并，不同则分开保留。'
          )}
        </Text>
      </View>
      {props.pairs.map((pair) => (
        <View
          key={`${pair.nodeId}:${pair.peerId}`}
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderControl
            }
          ]}
        >
          <View style={styles.similarNodeRow}>
            <Text style={[styles.similarNodeLabel, { color: colors.textSecondary }]}>
              {t('graph.similar_node_1', '节点1：')}
            </Text>
            <Pressable
              onPress={() => props.onLocateNode(pair.nodeId)}
              style={styles.similarNodePressable}
            >
              <Text style={[styles.similarNodeName, { color: colors.primary }]}>
                {pair.nodeName}
              </Text>
            </Pressable>
            <Button size="sm" variant="outlined" onPress={() => props.onLocateNode(pair.nodeId)}>
              {t('graph.locate', '查看')}
            </Button>
          </View>
          <View style={styles.similarNodeRow}>
            <Text style={[styles.similarNodeLabel, { color: colors.textSecondary }]}>
              {t('graph.similar_node_2', '节点2：')}
            </Text>
            <Pressable
              onPress={() => props.onLocateNode(pair.peerId)}
              style={styles.similarNodePressable}
            >
              <Text style={[styles.similarNodeName, { color: colors.primary }]}>
                {pair.peerName}
              </Text>
            </Pressable>
            <Button size="sm" variant="outlined" onPress={() => props.onLocateNode(pair.peerId)}>
              {t('graph.locate', '查看')}
            </Button>
          </View>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
            {t('graph.similar_similarity', '相似度 {{percent}}%', {
              percent: Math.round(pair.similarity * 100)
            })}
          </Text>
          <Text
            style={[
              styles.cardMeta,
              { color: colors.textSecondary, marginTop: sharedTokens.spacing.sm }
            ]}
          >
            {t('graph.similar_reason', '理由')}
          </Text>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{pair.reason}</Text>
          {pair.sourceExcerpt ? (
            <Text
              style={[
                styles.cardMeta,
                { color: colors.textPrimary, marginTop: sharedTokens.spacing.sm }
              ]}
            >
              {pair.sourceExcerpt}
            </Text>
          ) : null}
          <View style={[styles.row, { justifyContent: 'flex-end' }]}>
            <Button size="sm" isDisabled={props.busy} onPress={() => props.onMerge(pair)}>
              {t('graph.similar_merge', '合并')}
            </Button>
            <Button
              size="sm"
              variant="outlined"
              isDisabled={props.busy}
              onPress={() => props.onKeepApart(pair)}
            >
              {t('graph.similar_keep_apart', '不是同一人')}
            </Button>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
