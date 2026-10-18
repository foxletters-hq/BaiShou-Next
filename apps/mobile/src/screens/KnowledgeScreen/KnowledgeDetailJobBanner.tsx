import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import {
  knowledgeOrganizeBannerKind,
  knowledgeOrganizeBannerProgress,
  knowledgeOrganizeCurrentPhase,
  knowledgeOrganizeDetailSources,
  knowledgeOrganizeFailedMessage,
  knowledgeOrganizeRestartTarget,
  knowledgeOrganizeSourceCount,
  knowledgeOrganizeTaskActions,
  type KnowledgeOrganizeJobItem,
  type KnowledgeOrganizePhaseRow
} from './knowledge-organize-banner.util'
import {
  KnowledgeOrganizeTaskActions,
  KnowledgeOrganizeTaskCard
} from './KnowledgeOrganizeTaskCard'
import { knowledgeIngestUserMessage } from './knowledge-screen.util'
import type { KnowledgeOcrProgressState } from './knowledge-detail.types'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeDetailJobBanner(props: {
  pendingJobs: number
  graphProgress: string
  ingestingCount: number
  watching?: boolean
  knownTotal?: number
  busy?: boolean
  sources?: Array<{
    id: string
    title: string
    status: string
    errorMessage?: string | null
    pageCount?: number | null
  }>
  graphJobItems?: KnowledgeOrganizeJobItem[]
  ingestJobItems?: KnowledgeOrganizeJobItem[]
  ocrProgressBySource?: Record<string, KnowledgeOcrProgressState>
  onRetry?: () => void
  onRestartSource?: (sourceId: string, target: 'extract' | 'embed' | 'graph') => void
  onCancelSource?: (sourceId: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [open, setOpen] = React.useState(false)
  const items = props.graphJobItems ?? []
  const ingestJobItems = props.ingestJobItems ?? []
  const ocrProgressBySource = props.ocrProgressBySource ?? {}
  const sources = props.sources ?? []
  const kind = knowledgeOrganizeBannerKind({
    watching: props.watching,
    ingestingCount: props.ingestingCount,
    pendingJobs: props.pendingJobs,
    graphJobItems: items,
    ocrProgressBySource,
    ingestJobItems
  })
  if (kind === 'idle') return null
  const count = knowledgeOrganizeSourceCount({
    ingestingCount: props.ingestingCount,
    pendingJobs: props.pendingJobs,
    graphJobItems: items,
    ingestJobItems,
    ocrProgressBySource
  })
  const processInput = {
    watching: props.watching,
    sources,
    graphJobItems: items,
    ocrProgressBySource,
    ingestJobItems
  }
  const detailSources = knowledgeOrganizeDetailSources(processInput)
  const batch = knowledgeOrganizeBannerProgress({
    knownTotal: props.knownTotal,
    sources: detailSources
  })
  const percent = batch.percent
  const failedMessage = knowledgeOrganizeFailedMessage(detailSources)
  const failedError = failedMessage ? knowledgeIngestUserMessage(failedMessage, t) : ''
  const incomplete = kind === 'paused'
  const title =
    kind === 'failed'
      ? t('knowledge.organize_failed', '抽取失败')
      : incomplete
        ? t('knowledge.organize_incomplete', '整理未完成')
        : batch.total > 1
          ? t('knowledge.organize_progress_of', '正在整理 {{done}}/{{total}} 份资料', {
              done: batch.done,
              total: batch.total
            })
          : count > 0
            ? t('knowledge.organize_count', '正在整理 {{count}} 份资料', { count })
            : t('knowledge.organize_title', '正在整理')

  return (
    <View
      style={{
        marginHorizontal: tokens.spacing.md,
        marginBottom: tokens.spacing.md,
        padding: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: colors.borderControl,
        backgroundColor: colors.bgSurface,
        gap: tokens.spacing.sm
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm
        }}
      >
        {kind === 'running' ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            color: kind === 'failed' ? colors.error : colors.textPrimary,
            fontSize: mobileTypography.primary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexShrink: 0,
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: tokens.spacing.sm
          }}
        >
          <Button
            variant="outlined"
            size="sm"
            hitSlop={tokens.spacing.md}
            onPress={() => setOpen(true)}
          >
            {t('knowledge.organize_view_details', '查看详情')}
          </Button>
          {kind === 'paused' && props.onRetry ? (
            <Button
              variant="outlined"
              size="sm"
              disabled={props.busy}
              onPress={() => {
                setOpen(false)
                props.onRetry?.()
              }}
            >
              {t('knowledge.organize_continue', '继续整理')}
            </Button>
          ) : null}
        </View>
      </View>
      {kind === 'failed' && failedError ? (
        <Text
          style={{
            color: colors.error,
            fontSize: mobileTypography.secondary.fontSize
          }}
        >
          {failedError}
        </Text>
      ) : null}
      {kind === 'failed' && props.onRetry ? (
        <View style={[modalActionsStyle, { marginTop: 0 }]}>
          <Button
            variant="outlined"
            size="sm"
            disabled={props.busy}
            onPress={() => {
              setOpen(false)
              props.onRetry?.()
            }}
          >
            {t('knowledge.retry', '重试')}
          </Button>
        </View>
      ) : null}
      {kind !== 'failed' ? (
        <View style={[styles.organizePhaseTrack, { backgroundColor: colors.bgSurfaceNormal }]}>
          <View
            style={{
              height: '100%',
              width: `${percent}%`,
              backgroundColor: colors.primary
            }}
          />
        </View>
      ) : null}
      {detailSources.map((row) => {
        const current = knowledgeOrganizeCurrentPhase(row.phases)
        if (!current) return null
        return (
          <KnowledgeOrganizeTaskCard
            key={row.sourceId}
            title={row.title}
            phaseLabel={organizeProcessPhaseLabel(current.id, t)}
            phaseValue={organizePhaseCounts(current, t)}
            error={row.error ? knowledgeIngestUserMessage(row.error, t) : undefined}
            busy={props.busy}
            actions={knowledgeOrganizeTaskActions(row.phases)}
            onRestart={() =>
              props.onRestartSource?.(row.sourceId, knowledgeOrganizeRestartTarget(row.phases))
            }
            onCancel={() => props.onCancelSource?.(row.sourceId)}
          />
        )
      })}
      <Modal visible={open} title={title} onClose={() => setOpen(false)}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: tokens.spacing.xl * 10 }}
          contentContainerStyle={{ paddingHorizontal: tokens.spacing.mdTight }}
        >
          {detailSources.length > 0 ? (
            detailSources.map((row) => (
              <Card key={row.sourceId} style={styles.organizeTaskCard}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: mobileTypography.secondary.fontWeight
                  }}
                  numberOfLines={1}
                >
                  {row.title}
                </Text>
                {row.phases.map((phase) => {
                  const barPercent = organizePhasePercent(phase)
                  return (
                    <View
                      key={phase.id}
                      style={[
                        styles.organizePhaseRow,
                        { gap: tokens.spacing.xs, marginBottom: tokens.spacing.xxs }
                      ]}
                    >
                      <Text
                        style={[
                          styles.organizePhaseLabel,
                          {
                            color:
                              phase.status === 'failed'
                                ? colors.error
                                : phase.status === 'pending'
                                  ? colors.textTertiary
                                  : colors.textPrimary,
                            fontSize: mobileTypography.secondary.fontSize
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {organizeProcessPhaseLabel(phase.id, t)}
                      </Text>
                      <View
                        style={[
                          styles.organizePhaseBar,
                          styles.organizePhaseTrack,
                          { backgroundColor: colors.bgSurfaceNormal }
                        ]}
                      >
                        <View
                          style={{
                            height: '100%',
                            width: `${barPercent}%`,
                            backgroundColor: colors.primary
                          }}
                        />
                      </View>
                      <Text
                        style={[
                          styles.organizePhaseValue,
                          {
                            color: phase.status === 'failed' ? colors.error : colors.textSecondary,
                            fontSize: mobileTypography.caption.fontSize
                          }
                        ]}
                      >
                        {organizePhaseValue(phase, t)}
                      </Text>
                    </View>
                  )
                })}
                {row.error ? (
                  <Text
                    style={{
                      color: colors.error,
                      fontSize: mobileTypography.secondary.fontSize
                    }}
                  >
                    {knowledgeIngestUserMessage(row.error, t)}
                  </Text>
                ) : null}
                {row.hint ? (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: mobileTypography.secondary.fontSize
                    }}
                  >
                    {knowledgeIngestUserMessage(row.hint, t)}
                  </Text>
                ) : null}
                <KnowledgeOrganizeTaskActions
                  actions={knowledgeOrganizeTaskActions(row.phases)}
                  busy={props.busy}
                  onRestart={() => {
                    setOpen(false)
                    props.onRestartSource?.(
                      row.sourceId,
                      knowledgeOrganizeRestartTarget(row.phases)
                    )
                  }}
                  onCancel={() => {
                    setOpen(false)
                    props.onCancelSource?.(row.sourceId)
                  }}
                />
              </Card>
            ))
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize,
                marginBottom: tokens.spacing.sm
              }}
            >
              {props.graphProgress
                ? `${t('knowledge.graph_progress', '图谱')} · ${props.graphProgress}`
                : t('knowledge.organize_title', '正在整理')}
            </Text>
          )}
        </ScrollView>
        <View style={modalActionsStyle}>
          {kind === 'paused' && props.onRetry ? (
            <Button
              size="sm"
              variant="outlined"
              disabled={props.busy}
              onPress={() => {
                setOpen(false)
                props.onRetry?.()
              }}
            >
              {t('knowledge.organize_continue', '继续整理')}
            </Button>
          ) : null}
          {kind === 'failed' && props.onRetry ? (
            <Button
              size="sm"
              variant="outlined"
              disabled={props.busy}
              onPress={() => {
                setOpen(false)
                props.onRetry?.()
              }}
            >
              {t('knowledge.retry', '重试')}
            </Button>
          ) : null}
          <Button size="sm" onPress={() => setOpen(false)}>
            {t('common.got_it', '知道了')}
          </Button>
        </View>
      </Modal>
    </View>
  )
}

function organizeProcessPhaseLabel(
  phase: 'extract' | 'embed' | 'graph' | 'graphNodes',
  t: (key: string, fallback: string) => string
): string {
  if (phase === 'extract') return t('knowledge.organize_phase_extract', '文本提取')
  if (phase === 'embed') return t('knowledge.organize_phase_embed', '向量嵌入')
  if (phase === 'graphNodes') return t('knowledge.organize_phase_graph_nodes', '节点向量')
  return t('knowledge.organize_phase_graph', '图谱抽取')
}

function organizePhaseCounts(
  phase: Pick<
    KnowledgeOrganizePhaseRow,
    'status' | 'completed' | 'total' | 'pageFrom' | 'pageTo' | 'pageTotal'
  >,
  t: (key: string, fallback: string, options?: Record<string, number>) => string
): string {
  if (phase.status === 'failed') return t('knowledge.organize_phase_failed', '失败')
  if (phase.status === 'pending' && phase.total <= 0) {
    return t('knowledge.status_pending', '等待中')
  }
  if (phase.status === 'done') return t('knowledge.organize_phase_done', '已完成')
  if (phase.pageTotal && phase.pageTo) {
    if (phase.pageFrom && phase.pageFrom !== phase.pageTo) {
      return t('knowledge.graph_progress_page_range', '第 {{from}}–{{to}} / {{total}} 页', {
        from: phase.pageFrom,
        to: phase.pageTo,
        total: phase.pageTotal
      })
    }
    return t('knowledge.graph_progress_page', '第 {{page}} / {{total}} 页', {
      page: phase.pageTo,
      total: phase.pageTotal
    })
  }
  if (phase.total > 0) return `${phase.completed}/${phase.total}`
  if (phase.completed > 0) {
    return t('knowledge.organize_phase_page', '第 {{completed}} 页', {
      completed: phase.completed
    })
  }
  return t('knowledge.organize_phase_running', '进行中')
}

function organizePhaseValue(
  phase: KnowledgeOrganizePhaseRow,
  t: (key: string, fallback: string, options?: Record<string, number>) => string
): string {
  return organizePhaseCounts(phase, t)
}

function organizePhasePercent(phase: KnowledgeOrganizePhaseRow): number {
  if (phase.status === 'done') return 100
  if (phase.status !== 'running' || phase.total <= 0) return 0
  return Math.min(100, Math.max(0, (phase.completed / phase.total) * 100))
}
