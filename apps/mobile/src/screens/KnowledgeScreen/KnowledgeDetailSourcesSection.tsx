import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  HelpTooltip,
  SettingsSection,
  Tooltip,
  useNativeTheme
} from '@baishou/ui/native'
import {
  knowledgeIngestProgressLabel,
  knowledgeSourceCanCancelExtract,
  knowledgeSourceCanEmbed,
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanReembedVector,
  knowledgeSourceCanRetry,
  knowledgeSourceDisplayStatus,
  knowledgeSourceNeedsOcr,
  knowledgeSourceStatusLabel
} from './knowledge-screen.util'
import { pickSourceCardEvidence, sourceMissingPageCount } from './knowledge-source-preview.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'

export function KnowledgeDetailSourcesSection(props: {
  sources: KnowledgeSourceRow[]
  busy: boolean
  ocrProgressBySource: Record<string, KnowledgeOcrProgressState>
  graphJobStatusBySource?: Record<string, string>
  uploadingSources?: Array<{
    localId: string
    fileName: string
    status: 'importing' | 'failed'
    error?: string
  }>
  onDismissUploading?: (localId: string) => void
  onRetrySource: (source: KnowledgeSourceRow) => void
  onReprocessGraph: (source: KnowledgeSourceRow) => void
  onReprocessVector: (source: KnowledgeSourceRow) => void
  onEmbedSource: (source: KnowledgeSourceRow) => void
  onCancelExtract: (source: KnowledgeSourceRow) => void
  onOcrMissing: (source: KnowledgeSourceRow) => void
  onPreviewExtracted: (source: KnowledgeSourceRow) => void
  onPreviewOriginal: (source: KnowledgeSourceRow) => void
  onDeleteSource: (source: KnowledgeSourceRow) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    sources,
    busy,
    ocrProgressBySource,
    graphJobStatusBySource = {},
    uploadingSources = [],
    onDismissUploading,
    onRetrySource,
    onReprocessGraph,
    onReprocessVector,
    onEmbedSource,
    onCancelExtract,
    onOcrMissing,
    onPreviewExtracted,
    onPreviewOriginal,
    onDeleteSource
  } = props

  return (
    <SettingsSection title={t('knowledge.tab_sources', '资料')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        {uploadingSources.map((row) => (
          <Card key={row.localId}>
            <View style={{ gap: tokens.spacing.sm, padding: tokens.spacing.sm }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: settingsTypography.row.fontSize
                }}
              >
                {row.fileName}
              </Text>
              <Text
                style={{
                  color: row.status === 'failed' ? colors.error : colors.textSecondary,
                  fontSize: settingsTypography.desc.fontSize
                }}
              >
                {row.status === 'failed'
                  ? row.error || t('knowledge.import_failed', '导入失败')
                  : t('knowledge.importing', '正在导入…')}
              </Text>
              {row.status === 'failed' ? (
                <Button onPress={() => onDismissUploading?.(row.localId)}>
                  {t('common.close', '关闭')}
                </Button>
              ) : null}
            </View>
          </Card>
        ))}
        {sources.length === 0 && uploadingSources.length === 0 ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              fontWeight: settingsTypography.desc.fontWeight
            }}
          >
            {t('knowledge.empty_sources', '还没有资料，先导入 PDF / Markdown / URL。')}
          </Text>
        ) : (
          sources.map((s) => {
            const missingPages = sourceMissingPageCount(s)
            const evidence = pickSourceCardEvidence({
              pageCount: s.pageCount,
              missingPages,
              hideHints: Boolean(ocrProgressBySource[s.id])
            })
            const displayStatus = knowledgeSourceDisplayStatus(
              s.status,
              graphJobStatusBySource[s.id]
            )
            const ingestLabel = knowledgeIngestProgressLabel(t, ocrProgressBySource[s.id])
            return (
              <Card key={s.id}>
                <View style={{ gap: tokens.spacing.sm, padding: tokens.spacing.sm }}>
                  <View style={[styles.sourceRow, { gap: tokens.spacing.sm }]}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        flex: 1,
                        fontSize: settingsTypography.row.fontSize,
                        fontWeight: settingsTypography.row.fontWeight
                      }}
                    >
                      {s.title}
                    </Text>
                    <View style={[styles.sourceStatus, { gap: tokens.spacing.xs }]}>
                      {s.status === 'failed' && s.errorMessage?.trim() ? (
                        <Tooltip content={s.errorMessage.trim()}>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: settingsTypography.desc.fontSize
                            }}
                          >
                            {knowledgeSourceStatusLabel(displayStatus, t)}
                          </Text>
                        </Tooltip>
                      ) : (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: settingsTypography.desc.fontSize
                          }}
                        >
                          {knowledgeSourceStatusLabel(displayStatus, t)}
                        </Text>
                      )}
                      {ingestLabel ? (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: settingsTypography.desc.fontSize
                          }}
                        >
                          {ingestLabel}
                        </Text>
                      ) : null}
                      {s.status === 'stored' ? (
                        <HelpTooltip
                          content={t(
                            'knowledge.status_stored_help',
                            '未整理之前，AI 无法使用这份资料。'
                          )}
                        />
                      ) : null}
                    </View>
                  </View>
                  {evidence ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: settingsTypography.desc.fontSize
                      }}
                    >
                      {t(
                        'knowledge.source_scan_pages',
                        '扫描件 {{missing}} / {{total}} 页缺文字层',
                        {
                          missing: evidence.missingPages,
                          total: evidence.pageCount
                        }
                      )}
                    </Text>
                  ) : null}
                  <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                    <Button isDisabled={busy} onPress={() => void onPreviewOriginal(s)}>
                      {t('knowledge.source_preview', '原文预览')}
                    </Button>
                    <Button isDisabled={busy} onPress={() => void onPreviewExtracted(s)}>
                      {t('knowledge.extracted_preview', '抽出正文')}
                    </Button>
                    {knowledgeSourceCanEmbed(s.status) ? (
                      <Button isDisabled={busy} onPress={() => void onEmbedSource(s)}>
                        {t('knowledge.embed_source', '开始嵌入')}
                      </Button>
                    ) : null}
                    {knowledgeSourceCanCancelExtract(s) || ocrProgressBySource[s.id] ? (
                      <Button isDisabled={busy} onPress={() => void onCancelExtract(s)}>
                        {t('knowledge.cancel_extract', '取消提取')}
                      </Button>
                    ) : null}
                    {knowledgeSourceNeedsOcr(s.status) && !ocrProgressBySource[s.id] ? (
                      <Button isDisabled={busy} onPress={() => void onOcrMissing(s)}>
                        {t('knowledge.ocr_missing', '补 OCR')}
                      </Button>
                    ) : null}
                    {knowledgeSourceCanRetry(s.status) ? (
                      <Button isDisabled={busy} onPress={() => void onRetrySource(s)}>
                        {t('knowledge.retry', '重试')}
                      </Button>
                    ) : null}
                    {knowledgeSourceCanReembedVector(s.status) ? (
                      <Button isDisabled={busy} onPress={() => void onReprocessVector(s)}>
                        {t('knowledge.reembed_vector', '重新嵌入')}
                      </Button>
                    ) : null}
                    {knowledgeSourceCanReembedGraph(s.status) ? (
                      <Button isDisabled={busy} onPress={() => void onReprocessGraph(s)}>
                        {t('knowledge.reembed_graph', '重抽图')}
                      </Button>
                    ) : null}
                    <Button isDisabled={busy} destructive onPress={() => void onDeleteSource(s)}>
                      {t('knowledge.delete_source', '删除')}
                    </Button>
                  </View>
                </View>
              </Card>
            )
          })
        )}
      </View>
    </SettingsSection>
  )
}
