import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, HelpTooltip, Tooltip, useNativeTheme } from '@baishou/ui/native'
import {
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanRetry,
  knowledgeSourceStatusLabel
} from './knowledge-screen.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeSourceRow } from './knowledge-detail.types'

export function KnowledgeDetailSourcesSection(props: {
  sources: KnowledgeSourceRow[]
  busy: boolean
  onRetrySource: (source: KnowledgeSourceRow) => void
  onReprocessGraph: (source: KnowledgeSourceRow) => void
  onDeleteSource: (source: KnowledgeSourceRow) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { sources, busy, onRetrySource, onReprocessGraph, onDeleteSource } = props

  return (
    <>
      <Text style={[styles.section, { color: colors.textPrimary }]}>
        {t('knowledge.tab_sources', '资料')}
      </Text>
      {sources.length === 0 ? (
        <Text style={{ color: colors.textSecondary }}>
          {t('knowledge.empty_sources', '还没有资料，先导入 PDF / Markdown / URL。')}
        </Text>
      ) : (
        sources.map((s) => (
          <View key={s.id} style={[styles.sourceCard, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.sourceRow}>
              <Text style={{ color: colors.textPrimary, flex: 1 }}>{s.title}</Text>
              <View style={styles.sourceStatus}>
                {s.status === 'failed' && s.errorMessage?.trim() ? (
                  <Tooltip content={s.errorMessage.trim()}>
                    <Text style={{ color: colors.textSecondary }}>
                      {knowledgeSourceStatusLabel(s.status, t)}
                    </Text>
                  </Tooltip>
                ) : (
                  <Text style={{ color: colors.textSecondary }}>
                    {knowledgeSourceStatusLabel(s.status, t)}
                  </Text>
                )}
                {s.status === 'stored' ? (
                  <HelpTooltip
                    content={t('knowledge.status_stored_help', '未整理之前，AI 无法使用这份资料。')}
                  />
                ) : null}
              </View>
            </View>
            <View style={styles.rowGap}>
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
        ))
      )}
    </>
  )
}
