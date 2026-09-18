import React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { normalizeGraphFilePath } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'

export function GraphScreenReextractTab(props: {
  pending: Array<{ filePath: string; date?: string }>
  queueByPath: Map<string, { status?: string }>
  onRunExtract: (filePaths: string[]) => void
  onCancelQueueItem: (filePath: string) => void
  onOpenSource: (date: string) => void
  listPad: { padding: number; paddingBottom: number }
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <FlatList
      data={props.pending}
      keyExtractor={(item) => item.filePath}
      contentContainerStyle={props.listPad}
      ListEmptyComponent={
        <Text style={{ color: colors.textSecondary }}>
          {t('graph.reextract_empty', '暂无待重抽日记')}
        </Text>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {item.date || item.filePath}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{item.filePath}</Text>
          <View style={styles.row}>
            {(() => {
              const q = props.queueByPath.get(normalizeGraphFilePath(item.filePath))
              if (q?.status === 'running') {
                return (
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.queue_running', '抽取中')}
                  </Text>
                )
              }
              if (q?.status === 'aligning') {
                return (
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.extract_aligning', '对齐中')}
                  </Text>
                )
              }
              if (q?.status === 'pending') {
                return (
                  <>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {t('graph.queue_pending', '排队中')}
                    </Text>
                    <Pressable onPress={() => props.onCancelQueueItem(item.filePath)}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {t('graph.queue_remove', '取消')}
                      </Text>
                    </Pressable>
                  </>
                )
              }
              if (q?.status === 'completed') {
                return (
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                    {t('graph.queue_done', '已完成')}
                  </Text>
                )
              }
              return (
                <Pressable onPress={() => void props.onRunExtract([item.filePath])}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.extract_one', '抽取')}
                  </Text>
                </Pressable>
              )
            })()}
            {item.date ? (
              <Pressable onPress={() => void props.onOpenSource(item.date!)}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {t('graph.open_source', '原文')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    />
  )
}
