import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, useNativeTheme } from '@baishou/ui/native'
import { knowledgeIngestProgressLabel, knowledgeSourceStatusLabel } from './knowledge-screen.util'
import type { KnowledgeOcrProgressState } from './knowledge-detail.types'

export function KnowledgeDetailJobBanner(props: {
  pendingJobs: number
  graphProgress: string
  ingestingCount: number
  graphJobItems?: Array<{
    sourceId: string
    title: string
    status: string
    lastError?: string | null
  }>
  ocrProgressBySource?: Record<string, KnowledgeOcrProgressState>
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [open, setOpen] = React.useState(false)
  const items = props.graphJobItems ?? []
  const ocrEntries = Object.entries(props.ocrProgressBySource ?? {})
  if (
    props.pendingJobs <= 0 &&
    !props.graphProgress &&
    props.ingestingCount <= 0 &&
    items.length === 0 &&
    ocrEntries.length === 0
  ) {
    return null
  }
  return (
    <View
      style={{
        marginHorizontal: tokens.spacing.md,
        marginTop: tokens.spacing.md,
        padding: tokens.spacing.sm,
        borderRadius: tokens.radius.sm,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        backgroundColor: colors.bgSurface,
        gap: tokens.spacing.xs
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: settingsTypography.row.fontSize,
          fontWeight: settingsTypography.row.fontWeight
        }}
      >
        {t('knowledge.indexing', '索引中')}
        {props.pendingJobs > 0 ? ` · ${props.pendingJobs}` : ''}
      </Text>
      {props.graphProgress ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize
          }}
        >
          {t('knowledge.graph_progress', '图谱')} · {props.graphProgress}
        </Text>
      ) : null}
      {props.ingestingCount > 0 ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize
          }}
        >
          {t('knowledge.ingest_running_count', '{{count}} 份资料正在提取或嵌入', {
            count: props.ingestingCount
          })}
        </Text>
      ) : null}
      {ocrEntries.map(([sourceId, progress]) => (
        <Text
          key={sourceId}
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize
          }}
        >
          {knowledgeIngestProgressLabel(t, progress) ||
            t('knowledge.extract_progress', '提取 {{phase}} {{page}}/{{total}}', {
              phase: progress.phase || 'ocr',
              page: progress.page,
              total: progress.total
            })}
        </Text>
      ))}
      {items.map((item) => (
        <Text
          key={item.sourceId}
          style={{
            color: item.status === 'failed' ? colors.error : colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize
          }}
        >
          {item.title} ·{' '}
          {knowledgeSourceStatusLabel(
            item.status === 'running'
              ? 'graph_organizing'
              : item.status === 'pending'
                ? 'graph_queued'
                : item.status === 'failed'
                  ? 'graph_failed'
                  : item.status,
            t
          )}
          {item.lastError ? ` · ${item.lastError}` : ''}
        </Text>
      ))}
      <Button variant="outlined" onPress={() => setOpen(true)}>
        {t('knowledge.organize_count', '查看进度')}
      </Button>
      <Modal
        visible={open}
        title={t('knowledge.organize_title', '正在整理')}
        onClose={() => setOpen(false)}
      >
        {ocrEntries.map(([sourceId, progress]) => (
          <Text
            key={sourceId}
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              marginBottom: tokens.spacing.xs
            }}
          >
            {knowledgeIngestProgressLabel(t, progress)}
          </Text>
        ))}
        {items.map((item) => (
          <Text
            key={item.sourceId}
            style={{
              color: item.status === 'failed' ? colors.error : colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              marginBottom: tokens.spacing.xs
            }}
          >
            {item.title} · {item.status}
            {item.lastError ? ` · ${item.lastError}` : ''}
          </Text>
        ))}
        <Button onPress={() => setOpen(false)}>{t('common.got_it', '知道了')}</Button>
      </Modal>
    </View>
  )
}
