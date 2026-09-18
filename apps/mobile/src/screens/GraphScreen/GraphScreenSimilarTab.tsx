import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'

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
      <Text style={[styles.pendingHintText, { color: colors.textSecondary }]}>
        {t('graph.similar_hint', '模型吃不准这两人是不是同一个。能并就合并，不能并就分开保留。')}
      </Text>
      {props.pairs.map((pair) => (
        <View key={`${pair.nodeId}:${pair.peerId}`} style={styles.card}>
          <Pressable onPress={() => props.onLocateNode(pair.nodeId)}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>{pair.nodeName}</Text>
          </Pressable>
          <Pressable onPress={() => props.onLocateNode(pair.peerId)}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>{pair.peerName}</Text>
          </Pressable>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
            {t('graph.similar_similarity', '相似度 {{percent}}%', {
              percent: Math.round(pair.similarity * 100)
            })}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            {t('graph.similar_reason', '理由')}
          </Text>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{pair.reason}</Text>
          {pair.sourceExcerpt ? (
            <Text style={[styles.cardMeta, { color: colors.textPrimary, marginTop: 8 }]}>
              {pair.sourceExcerpt}
            </Text>
          ) : null}
          <View style={styles.row}>
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
