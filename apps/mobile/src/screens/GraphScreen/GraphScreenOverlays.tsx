import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  describeGraphExtractPhase,
  describeGraphExtractQueueError,
  graphExtractBarPercent,
  graphExtractOverallProgress
} from '@baishou/shared'
import { FloatingModal, MarkdownRenderer, useNativeTheme } from '@baishou/ui/native'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { GraphCreateNodeSheet } from './GraphCreateNodeSheet'
import { GraphExtractHelpButton } from './GraphExtractHelpButton'
import { GraphIrreversibleConfirm, type GraphMergeConfirmTarget } from './GraphIrreversibleConfirm'
import { GraphMergeSearchSheet } from './GraphMergeSearchSheet'
import { GraphSplitNodeSheet } from './GraphSplitNodeSheet'
import { graphMergeSearchSeed, graphSplitInitialLabel } from './graph-screen-view.util'
import type { GraphExtractQueueSnapshot, GraphSourcePreview } from './graph-screen.types'
import { styles } from './GraphScreen.styles'

export function GraphScreenOverlays(props: {
  queueModalOpen: boolean
  onCloseQueue: () => void
  extractRunning: boolean
  extractQueue: GraphExtractQueueSnapshot | null
  extractConcurrency: number
  onChangeConcurrency: (n: number) => void
  onCancelQueueItem: (filePath: string) => void
  onStopExtract: () => void
  sourcePreview: GraphSourcePreview | null
  onCloseSource: () => void
  createOpen: boolean
  splitOpen: boolean
  mergeSearchOpen: boolean
  mergeConfirm: GraphMergeConfirmTarget | null
  busy: boolean
  services: { pathService: unknown; fileSystem: unknown } | null
  vaultId: string
  vaultName: string
  selectedId: string | null
  selectedNode: any | null
  sameNameEntities: Array<{ nodeId: string; label: string }>
  findNode: (id: string) => any | null
  onCloseCreate: () => void
  onCreated: (id: string) => void
  onOpenExisting: (id: string) => void
  onCloseSplit: () => void
  onSplit: (id: string) => void
  onCloseMergeSearch: () => void
  onRequestMerge: (target: GraphMergeConfirmTarget) => void
  onCancelMerge: () => void
  onConfirmMerge: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const extractQueue = props.extractQueue

  return (
    <>
      <FloatingModal
        visible={props.queueModalOpen && (extractQueue?.items.length ?? 0) > 0}
        onClose={props.onCloseQueue}
        maxWidth={Math.min(screenWidth - 32, 440)}
      >
        <View style={styles.queueModalPad}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {props.extractRunning
              ? t('graph.queue_modal_title_running', '正在整理日记')
              : t('graph.queue_modal_title_done', '整理进度')}
          </Text>
          <Text style={[styles.queueModalSubtitle, { color: colors.textSecondary }]}>
            {props.extractRunning
              ? t('graph.queue_modal_hint', '关掉窗口不会中断，可继续添加其他日记')
              : t('graph.queue_modal_progress', '已完成 {{current}} / {{total}} 篇', {
                  current: extractQueue?.completedCount ?? 0,
                  total: extractQueue?.items.length ?? 0
                })}
          </Text>
          <View style={styles.concurrencyRow}>
            <View style={styles.opsLabelRow}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {t('graph.extract_concurrency', '同时抽取')}
              </Text>
              <GraphExtractHelpButton size={14} />
            </View>
            {Array.from(
              { length: GRAPH_EXTRACT_CONCURRENCY_MAX - GRAPH_EXTRACT_CONCURRENCY_MIN + 1 },
              (_, i) => GRAPH_EXTRACT_CONCURRENCY_MIN + i
            ).map((n) => (
              <Pressable
                key={n}
                onPress={() => props.onChangeConcurrency(n)}
                style={[
                  styles.concurrencyChip,
                  {
                    borderColor:
                      n === props.extractConcurrency ? colors.primary : colors.borderSubtle,
                    backgroundColor: n === props.extractConcurrency ? colors.primary : 'transparent'
                  }
                ]}
              >
                <Text
                  style={{
                    color: n === props.extractConcurrency ? '#fff' : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '600'
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.queueOverallRow}>
            <Text style={[styles.queueOverallPct, { color: colors.textPrimary }]}>
              {t('graph.queue_overall_pct', '总进度 {{percent}}%', {
                percent:
                  extractQueue?.overallProgress ??
                  graphExtractOverallProgress(extractQueue?.items ?? [])
              })}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t('graph.queue_modal_progress', '已完成 {{current}} / {{total}} 篇', {
                current: extractQueue?.completedCount ?? 0,
                total: extractQueue?.items.length ?? 0
              })}
            </Text>
          </View>
          <View
            style={[
              styles.queueProgress,
              { backgroundColor: colors.borderSubtle, marginTop: 8, height: 6 }
            ]}
          >
            <View
              style={[
                styles.queueProgressBar,
                {
                  width: `${
                    extractQueue?.overallProgress ??
                    graphExtractOverallProgress(extractQueue?.items ?? [])
                  }%`,
                  backgroundColor: colors.primary
                }
              ]}
            />
          </View>
          <ScrollView style={styles.queueModalList} keyboardShouldPersistTaps="handled">
            {(extractQueue?.items ?? []).map((q) => (
              <View key={q.id} style={styles.queueModalItem}>
                <View style={styles.queueDockItemRow}>
                  <Text
                    style={[styles.queueDockName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {q.date || q.filePath}
                  </Text>
                  <Text
                    style={{
                      color:
                        q.status === 'error'
                          ? colors.error
                          : q.status === 'completed'
                            ? colors.textSecondary
                            : colors.primary,
                      fontSize: 12,
                      fontWeight: '600'
                    }}
                  >
                    {q.status === 'running'
                      ? t('graph.queue_running', '抽取中')
                      : q.status === 'aligning'
                        ? t('graph.extract_aligning', '对齐中')
                        : q.status === 'pending'
                          ? t('graph.queue_pending', '排队中')
                          : q.status === 'completed'
                            ? t('graph.queue_done', '已完成')
                            : t('graph.queue_error', '失败')}
                  </Text>
                  {q.status === 'pending' || q.status === 'running' || q.status === 'aligning' ? (
                    <Pressable onPress={() => props.onCancelQueueItem(q.filePath)}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {t('graph.queue_remove', '取消')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {q.status === 'running' || q.status === 'aligning' ? (
                  <>
                    <View style={[styles.queueProgress, { backgroundColor: colors.borderSubtle }]}>
                      <View
                        style={[
                          styles.queueProgressBar,
                          {
                            width: `${graphExtractBarPercent(q)}%`,
                            backgroundColor: colors.primary
                          }
                        ]}
                      />
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      {(() => {
                        const copy = describeGraphExtractPhase(q)
                        return t(copy.key, copy.defaultValue, copy.params)
                      })()}
                    </Text>
                  </>
                ) : null}
                {q.status === 'error' && q.error ? (
                  <Text
                    style={{ color: colors.error, fontSize: 11, marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {(() => {
                      const copy = describeGraphExtractQueueError(q.error)
                      return t(copy.key, copy.defaultValue, copy.params)
                    })()}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <View style={styles.queueModalFooter}>
            {props.extractRunning ? (
              <Pressable onPress={props.onStopExtract}>
                <Text style={{ color: colors.error, fontWeight: '600' }}>
                  {t('graph.stop_extract', '全部停止')}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable onPress={props.onCloseQueue}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {props.extractRunning
                  ? t('graph.queue_modal_minimize', '收起，继续整理')
                  : t('common.close', '关闭')}
              </Text>
            </Pressable>
          </View>
        </View>
      </FloatingModal>

      <FloatingModal
        visible={Boolean(props.sourcePreview)}
        onClose={props.onCloseSource}
        maxWidth={Math.min(screenWidth - 32, 520)}
      >
        <View style={styles.sourceHeader}>
          <Text style={[styles.sourceTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {props.sourcePreview?.date
              ? t('graph.source_preview_title', '{{date}} 原文', { date: props.sourcePreview.date })
              : t('graph.source_preview_title_generic', '原文')}
          </Text>
          <Pressable onPress={props.onCloseSource} hitSlop={8}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
              {t('common.close', '关闭')}
            </Text>
          </Pressable>
        </View>
        {props.sourcePreview?.loading ? (
          <View style={styles.sourceLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.sourceScroll}
            contentContainerStyle={styles.sourceScrollContent}
            showsVerticalScrollIndicator
          >
            <MarkdownRenderer content={props.sourcePreview?.content || ''} variant="preview" />
          </ScrollView>
        )}
      </FloatingModal>

      {props.services ? (
        <GraphCreateNodeSheet
          visible={props.createOpen}
          drizzleDb={getAgentDbRuntime()?.drizzleDb ?? null}
          pathService={props.services.pathService as never}
          fileSystem={props.services.fileSystem as never}
          vaultId={props.vaultId}
          vaultName={props.vaultName}
          busy={props.busy}
          onClose={props.onCloseCreate}
          onCreated={props.onCreated}
          onOpenExisting={props.onOpenExisting}
        />
      ) : null}
      {props.services ? (
        <GraphSplitNodeSheet
          visible={props.splitOpen}
          nodeId={props.selectedNode?.id ?? null}
          nodeName={props.selectedNode?.name}
          initialDiscriminator={
            typeof props.selectedNode?.discriminator === 'string'
              ? props.selectedNode.discriminator
              : ''
          }
          initialLabel={graphSplitInitialLabel(props.selectedNode, props.sameNameEntities)}
          drizzleDb={getAgentDbRuntime()?.drizzleDb ?? null}
          pathService={props.services.pathService as never}
          fileSystem={props.services.fileSystem as never}
          vaultId={props.vaultId}
          vaultName={props.vaultName}
          busy={props.busy}
          onClose={props.onCloseSplit}
          onSplit={props.onSplit}
        />
      ) : null}
      <GraphMergeSearchSheet
        visible={props.mergeSearchOpen}
        drizzleDb={getAgentDbRuntime()?.drizzleDb ?? null}
        vaultId={props.vaultId}
        seed={graphMergeSearchSeed({
          selectedId: props.selectedId,
          selectedNode: props.selectedNode,
          findNode: props.findNode
        })}
        busy={props.busy}
        onClose={props.onCloseMergeSearch}
        onRequestMerge={props.onRequestMerge}
      />
      <GraphIrreversibleConfirm
        visible={!!props.mergeConfirm}
        title={t('graph.merge_nodes', '合并节点')}
        warning={t(
          'graph.merge_irreversible',
          '合并不可撤销。被合并节点会并入保留节点，关系改挂到保留节点，对端同步后只保留目标节点。'
        )}
        survivorName={props.mergeConfirm?.survivorName}
        losers={props.mergeConfirm?.losers}
        busy={props.busy}
        onCancel={props.onCancelMerge}
        onConfirm={props.onConfirmMerge}
      />
    </>
  )
}
