import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react-native'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, useNativeTheme } from '@baishou/ui/native'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { pairStatusRows } from './knowledge-screen.util'
import { KnowledgeDetailSourceCard } from './KnowledgeDetailSourceCard'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'

type SourceGridTile =
  | { key: string; kind: 'add' }
  | {
      key: string
      kind: 'upload'
      row: {
        localId: string
        fileName: string
        status: 'importing' | 'failed'
        error?: string
      }
    }
  | { key: string; kind: 'source'; source: KnowledgeSourceRow }

export function KnowledgeDetailSourcesSection(props: {
  sources: KnowledgeSourceRow[]
  busy: boolean
  ocrProgressBySource: Record<string, KnowledgeOcrProgressState>
  graphJobStatusBySource?: Record<string, string>
  watching?: boolean
  uploadingSources?: Array<{
    localId: string
    fileName: string
    status: 'importing' | 'failed'
    error?: string
  }>
  onAddSource: () => void
  onDismissUploading?: (localId: string) => void
  onRetrySource: (source: KnowledgeSourceRow) => void
  onRetryFailedGraph: (source: KnowledgeSourceRow) => void
  onReprocessGraph: (source: KnowledgeSourceRow) => void
  onReprocessVector: (source: KnowledgeSourceRow) => void
  onEmbedSource: (source: KnowledgeSourceRow) => void
  onCancelExtract: (source: KnowledgeSourceRow) => void
  onPreviewExtracted: (source: KnowledgeSourceRow) => void
  onPreviewOriginal: (source: KnowledgeSourceRow) => void
  onDeleteSource: (source: KnowledgeSourceRow) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const cardStyles = createKnowledgeScreenStyles(colors, tokens, isDark)
  const {
    sources,
    busy,
    ocrProgressBySource,
    graphJobStatusBySource = {},
    watching = false,
    uploadingSources = [],
    onAddSource,
    onDismissUploading,
    onRetrySource,
    onRetryFailedGraph,
    onReprocessGraph,
    onReprocessVector,
    onEmbedSource,
    onCancelExtract,
    onPreviewExtracted,
    onPreviewOriginal,
    onDeleteSource
  } = props
  const tiles: SourceGridTile[] = [
    { key: 'add', kind: 'add' },
    ...uploadingSources.map((row) => ({ key: row.localId, kind: 'upload' as const, row })),
    ...sources.map((source) => ({ key: source.id, kind: 'source' as const, source }))
  ]

  return (
    <View
      style={[
        styles.statusStrip,
        {
          marginHorizontal: tokens.spacing.md,
          marginBottom: tokens.spacing.sm,
          padding: tokens.spacing.sm,
          gap: tokens.spacing.sm,
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: colors.borderMuted
        }
      ]}
    >
      {pairStatusRows(tiles).map((pair) => (
        <View
          key={pair.map((tile) => tile.key).join('-')}
          style={[styles.chooserGrid, { gap: tokens.spacing.md }]}
        >
          {pair.map((tile) => {
            if (tile.kind === 'add') {
              return (
                <View key={tile.key} style={styles.chooserItem}>
                  <Pressable
                    onPress={onAddSource}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('knowledge.add_source', '添加来源')}
                  >
                    <Card style={[cardStyles.createCardInner, { aspectRatio: 1, minHeight: 0 }]}>
                      <View style={cardStyles.createCardIcon}>
                        <Plus size={22} color={colors.primary} strokeWidth={2.5} />
                      </View>
                      <Text style={cardStyles.createCardTitle}>
                        {t('knowledge.add_source', '添加来源')}
                      </Text>
                    </Card>
                  </Pressable>
                </View>
              )
            }
            if (tile.kind === 'upload') {
              return (
                <View key={tile.key} style={styles.chooserItem}>
                  <Card style={styles.sourceSquare}>
                    <View style={[styles.sourceSquareBody, { padding: tokens.spacing.md }]}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: mobileTypography.primary.fontSize,
                          fontWeight: mobileTypography.primary.fontWeight
                        }}
                        numberOfLines={2}
                      >
                        {tile.row.fileName}
                      </Text>
                      <Text
                        style={{
                          color: tile.row.status === 'failed' ? colors.error : colors.textSecondary,
                          fontSize: mobileTypography.secondary.fontSize
                        }}
                        numberOfLines={2}
                      >
                        {tile.row.status === 'failed'
                          ? tile.row.error || t('knowledge.import_failed', '导入失败')
                          : t('knowledge.importing', '正在导入…')}
                      </Text>
                      {tile.row.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="outlined"
                          onPress={() => onDismissUploading?.(tile.row.localId)}
                        >
                          {t('common.close', '关闭')}
                        </Button>
                      ) : null}
                    </View>
                  </Card>
                </View>
              )
            }
            return (
              <View key={tile.key} style={styles.chooserItem}>
                <KnowledgeDetailSourceCard
                  source={tile.source}
                  busy={busy}
                  ocrProgress={ocrProgressBySource[tile.source.id]}
                  graphJobStatus={graphJobStatusBySource[tile.source.id]}
                  watching={watching}
                  onRetrySource={onRetrySource}
                  onRetryFailedGraph={onRetryFailedGraph}
                  onReprocessGraph={onReprocessGraph}
                  onReprocessVector={onReprocessVector}
                  onEmbedSource={onEmbedSource}
                  onCancelExtract={onCancelExtract}
                  onPreviewExtracted={onPreviewExtracted}
                  onPreviewOriginal={onPreviewOriginal}
                  onDeleteSource={onDeleteSource}
                />
              </View>
            )
          })}
          {pair.length === 1 ? <View style={styles.chooserItem} pointerEvents="none" /> : null}
        </View>
      ))}
    </View>
  )
}
