import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, HelpTooltip, SettingsSection, Tooltip, useNativeTheme } from '@baishou/ui/native'
import {
  knowledgeSourceCanCancelExtract,
  knowledgeSourceCanEmbed,
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanRetry,
  knowledgeSourceNeedsOcr,
  knowledgeSourceStatusLabel
} from './knowledge-screen.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'

export function KnowledgeDetailSourcesSection(props: {
  sources: KnowledgeSourceRow[]
  busy: boolean
  ocrProgressBySource: Record<string, KnowledgeOcrProgressState>
  onRetrySource: (source: KnowledgeSourceRow) => void
  onReprocessGraph: (source: KnowledgeSourceRow) => void
  onEmbedSource: (source: KnowledgeSourceRow) => void
  onCancelExtract: (source: KnowledgeSourceRow) => void
  onOcrMissing: (source: KnowledgeSourceRow) => void
  onPreviewExtracted: (source: KnowledgeSourceRow) => void
  onDeleteSource: (source: KnowledgeSourceRow) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    sources,
    busy,
    ocrProgressBySource,
    onRetrySource,
    onReprocessGraph,
    onEmbedSource,
    onCancelExtract,
    onOcrMissing,
    onPreviewExtracted,
    onDeleteSource
  } = props

  return (
    <SettingsSection title={t('knowledge.tab_sources', '资料')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        {sources.length === 0 ? (
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
          sources.map((s) => (
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
                          {knowledgeSourceStatusLabel(s.status, t)}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: settingsTypography.desc.fontSize
                        }}
                      >
                        {knowledgeSourceStatusLabel(s.status, t)}
                      </Text>
                    )}
                    {ocrProgressBySource[s.id] ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: settingsTypography.desc.fontSize
                        }}
                      >
                        {ocrProgressBySource[s.id].phase === 'embed'
                          ? t('knowledge.status_embed_progress', '正在建立索引 {{page}}/{{total}}', {
                              page: ocrProgressBySource[s.id].page,
                              total: ocrProgressBySource[s.id].total
                            })
                          : t('knowledge.ocr_progress', '第 {{page}} / {{total}} 页', {
                              page: ocrProgressBySource[s.id].page,
                              total: ocrProgressBySource[s.id].total
                            })}
                      </Text>
                    ) : null}
                    {s.status === 'stored' ? (
                      <HelpTooltip
                        content={t('knowledge.status_stored_help', '未整理之前，AI 无法使用这份资料。')}
                      />
                    ) : null}
                  </View>
                </View>
                <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
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
          ))
        )}
      </View>
    </SettingsSection>
  )
}
