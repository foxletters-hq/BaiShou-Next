import React, { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MoreVertical } from 'lucide-react-native'
import { splitKnowledgeSourceErrorMessage } from '@baishou/shared'
import { iconSizes, mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, ContextMenu, HelpTooltip, Tooltip, useNativeTheme } from '@baishou/ui/native'
import {
  knowledgeIngestProgressLabel,
  knowledgeSourceDisplayStatus,
  knowledgeSourceStatusLabel,
  knowledgeSourceVisibleRetryKind
} from './knowledge-screen.util'
import { pickSourceCardEvidence, sourceMissingPageCount } from './knowledge-source-preview.util'
import {
  buildKnowledgeSourceCardMenuActions,
  type KnowledgeSourceCardMenuAction
} from './knowledge-source-card-menu.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'

export function KnowledgeDetailSourceCard(props: {
  source: KnowledgeSourceRow
  busy: boolean
  ocrProgress?: KnowledgeOcrProgressState
  graphJobStatus?: string
  watching?: boolean
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
  const { colors, tokens } = useNativeTheme()
  const moreRef = useRef<View>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [triggerLayout, setTriggerLayout] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const { source: s, busy, ocrProgress } = props
  const missingPages = sourceMissingPageCount(s)
  const evidence = pickSourceCardEvidence({
    pageCount: s.pageCount,
    missingPages,
    hideHints: Boolean(ocrProgress),
    status: s.status
  })
  const failureReason = splitKnowledgeSourceErrorMessage(s.errorMessage).error
  const displayStatus = knowledgeSourceDisplayStatus(s.status, props.graphJobStatus, props.watching)
  const ingestLabel = knowledgeIngestProgressLabel(t, ocrProgress)
  const retryKind = knowledgeSourceVisibleRetryKind({
    status: s.status,
    graphJobStatus: props.graphJobStatus,
    ocrRunning: Boolean(ocrProgress)
  })
  const actions = buildKnowledgeSourceCardMenuActions({
    status: s.status,
    extractEngine: s.extractEngine,
    ocrRunning: Boolean(ocrProgress)
  })

  const runAction = (action: KnowledgeSourceCardMenuAction) => {
    if (action === 'preview-original') props.onPreviewOriginal(s)
    else if (action === 'preview-extracted') props.onPreviewExtracted(s)
    else if (action === 'embed') props.onEmbedSource(s)
    else if (action === 'cancel') props.onCancelExtract(s)
    else if (action === 'retry') props.onRetrySource(s)
    else if (action === 'reembed-vector') props.onReprocessVector(s)
    else if (action === 'reembed-graph') props.onReprocessGraph(s)
    else props.onDeleteSource(s)
  }

  const openMenu = () => {
    moreRef.current?.measureInWindow((x, y, width, height) => {
      setTriggerLayout({ x, y, width, height })
      setMenuOpen(true)
    })
  }

  const statusText = (
    <Text
      style={{
        color: colors.textSecondary,
        fontSize: mobileTypography.secondary.fontSize
      }}
    >
      {knowledgeSourceStatusLabel(displayStatus, t)}
    </Text>
  )

  return (
    <Card style={[styles.sourceSquare, { padding: tokens.spacing.md }]}>
      <View style={styles.sourceSquareMenu}>
        <View ref={moreRef} collapsable={false}>
          <Pressable
            onPress={openMenu}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.more', '更多操作')}
            style={styles.sourceSquareMenuBtn}
          >
            <MoreVertical size={iconSizes.sm} color={colors.textSecondary} strokeWidth={1.75} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.sourceSquareBody, { gap: tokens.spacing.xs }]}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: mobileTypography.primary.fontSize,
            fontWeight: mobileTypography.primary.fontWeight,
            paddingRight: tokens.spacing.xl
          }}
          numberOfLines={3}
        >
          {s.title}
        </Text>
        <View style={{ gap: tokens.spacing.xs }}>
          {s.status === 'failed' && failureReason ? (
            <Tooltip content={failureReason}>{statusText}</Tooltip>
          ) : (
            statusText
          )}
          {ingestLabel ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize
              }}
              numberOfLines={2}
            >
              {ingestLabel}
            </Text>
          ) : null}
          {s.status === 'stored' ? (
            <HelpTooltip
              content={t('knowledge.status_stored_help', '未整理之前，AI 无法使用这份资料。')}
            />
          ) : null}
          {evidence ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize
              }}
              numberOfLines={2}
            >
              {t('knowledge.source_scan_pages', '扫描件 {{missing}} / {{total}} 页缺文字层', {
                missing: evidence.missingPages,
                total: evidence.pageCount
              })}
            </Text>
          ) : null}
          {retryKind ? (
            <Button
              size="sm"
              variant="outlined"
              disabled={busy}
              onPress={() => {
                if (retryKind === 'graph') props.onRetryFailedGraph(s)
                else props.onRetrySource(s)
              }}
            >
              {t('knowledge.retry', '重试')}
            </Button>
          ) : null}
        </View>
      </View>
      <ContextMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerLayout={triggerLayout}
        items={actions.map((action) => ({
          label: knowledgeSourceCardMenuLabel(action, t),
          destructive: action === 'delete',
          onPress: () => runAction(action)
        }))}
      />
    </Card>
  )
}

function knowledgeSourceCardMenuLabel(
  action: KnowledgeSourceCardMenuAction,
  t: (key: string, fallback: string) => string
): string {
  if (action === 'preview-original') return t('knowledge.source_preview', '原文预览')
  if (action === 'preview-extracted') return t('knowledge.extracted_preview', '抽出正文')
  if (action === 'embed') return t('knowledge.embed_source', '开始嵌入')
  if (action === 'cancel') return t('knowledge.cancel_extract', '取消提取')
  if (action === 'retry') return t('knowledge.retry', '重试')
  if (action === 'reembed-vector') return t('knowledge.reembed_vector', '重新嵌入')
  if (action === 'reembed-graph') return t('knowledge.reembed_graph', '重抽图')
  return t('knowledge.delete_source', '删除')
}
