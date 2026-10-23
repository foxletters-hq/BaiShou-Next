import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import {
  formatAiApiCallError,
  localizeAiApiErrorMessage,
  type EmbeddingMigrationStateView
} from '@baishou/shared'
import { showMigrationResultToast } from './migration-result-toast'
import {
  getCachedRagActiveState,
  patchCachedRagActiveState,
  setCachedRagActiveState,
  subscribeRagRuntime
} from '../rag-runtime-cache'

function extractIpcErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(
      /^(Batch embed failed|Migration failed|Migration resume failed):\s*/i,
      ''
    )
  }
  return formatAiApiCallError(error)
}

export function useRagSystem(
  t: any,
  toast: any,
  confirm: any,
  alert: any,
  fetchRagInfo: any,
  reloadSettings?: () => Promise<void>
) {
  const [isProcessing, setIsProcessing] = useState(false)
  const activeRagState = useSyncExternalStore(
    subscribeRagRuntime,
    () => getCachedRagActiveState(),
    () => getCachedRagActiveState()
  )
  const [hasMismatchModel, setHasMismatchModel] = useState(false)
  const [migrationState, setMigrationState] = useState<EmbeddingMigrationStateView | null>(null)
  const migrationWaitRef = useRef<{
    resolve: () => void
    reject: (error: Error) => void
  } | null>(null)
  const migrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (migrationTimeoutRef.current) {
        clearTimeout(migrationTimeoutRef.current)
        migrationTimeoutRef.current = null
      }
      migrationWaitRef.current = null
    }
  }, [])

  const refreshMigrationState = useCallback(async () => {
    try {
      const state = await (window as any).api?.rag?.getMigrationState?.()
      if (state) setMigrationState(state)
    } catch {}
  }, [])

  useEffect(() => {
    void refreshMigrationState()
  }, [refreshMigrationState])

  const checkMigrationStatus = useCallback(async () => {
    try {
      const [pending, mismatch] = await Promise.all([
        (window as any).api?.rag?.hasPendingMigration?.(),
        (window as any).api?.rag?.hasModelMismatch?.(),
        refreshMigrationState()
      ])
      setHasMismatchModel(!!pending || !!mismatch)
    } catch {
      // keep previous flag; callers may optimistically clear on known-complete outcomes
    }
  }, [refreshMigrationState])

  useEffect(() => {
    if (!activeRagState.isRunning) {
      void checkMigrationStatus()
      migrationWaitRef.current?.resolve()
      migrationWaitRef.current = null
    }
  }, [activeRagState.isRunning, checkMigrationStatus])

  const handleDetectDimension = async () => {
    setIsProcessing(true)
    try {
      const detectedDim = await (window as any).api?.rag?.detectDimension()
      await fetchRagInfo()
      if (detectedDim > 0) {
        toast.showSuccess(
          t('settings.rag.detect_success', '检测成功：${dimension}维').replace(
            '${dimension}',
            String(detectedDim)
          )
        )
      } else {
        toast.showError(
          t('ai_config.error_no_model', '检测失败：可能是未配置有效的 Embedding 模型或服务未连通。')
        )
      }
    } catch (e: any) {
      toast.showError(
        e?.message ||
          t('settings.rag.detect_error', '检测失败: $error').replace('$error', String(e))
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearDimension = async () => {
    if (
      !(await confirm(
        t('settings.rag_clear_dimension', '清理当前维度数据') + '?',
        t('common.warning', '警告')
      ))
    )
      return
    setIsProcessing(true)
    try {
      await (window as any).api?.rag?.clearDimension()
      await fetchRagInfo()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBatchEmbed = async () => {
    if (
      !(await confirm(
        t(
          'settings.rag_batch_embed_confirm',
          '将补齐尚未嵌入的日记、记忆、图谱节点和知识库。这只会写本机向量，不会产生同步流量。确定开始？'
        ),
        t('memory.start_organize', '开始整理记忆')
      ))
    )
      return
    setIsProcessing(true)
    patchCachedRagActiveState({
      isRunning: true,
      type: 'batchEmbed',
      progress: 0,
      total: 0,
      statusText: t('settings.rag_batch_embed_starting', '正在开始索引…'),
      phase: 'starting',
      error: undefined,
      paused: false,
      cancelling: false
    })
    try {
      const result = await (window as any).api?.rag?.triggerBatchEmbed()
      patchCachedRagActiveState({ error: undefined, paused: false, cancelling: false })
      await fetchRagInfo()
      await reloadSettings?.()
      if (result && typeof result === 'object' && result.alreadyRunning) {
        return
      }
      if (result && typeof result === 'object' && result.cancelled) {
        toast.showWarning(
          t('settings.rag_batch_embed_cancelled', '已取消索引。已经嵌入的部分会保留。')
        )
        return
      }
      const graphFailed =
        result && typeof result === 'object' && typeof result.graphFailed === 'number'
          ? result.graphFailed
          : 0
      if (graphFailed > 0) {
        toast.showWarning(
          t('settings.rag_batch_embed_partial', '索引完成，但有 {{count}} 个图谱节点未能嵌入。', {
            count: graphFailed
          })
        )
      } else {
        toast.showSuccess(t('settings.rag_batch_embed_done', '批量嵌入已完成'))
      }
    } catch (e: unknown) {
      const raw = extractIpcErrorMessage(e)
      const detail = localizeAiApiErrorMessage(raw, t)
      setCachedRagActiveState({
        ...getCachedRagActiveState(),
        isRunning: false,
        type: 'idle',
        paused: false,
        cancelling: false,
        error: detail
      })
      toast.showError(
        t('settings.rag_batch_embed_failed', '批量嵌入失败：{{message}}', { message: detail })
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePauseBatchEmbed = async () => {
    patchCachedRagActiveState({ paused: true, cancelling: false })
    await (window as any).api?.rag?.pauseBatchEmbed()
  }

  const handleResumeBatchEmbed = async () => {
    patchCachedRagActiveState({ paused: false, cancelling: false })
    await (window as any).api?.rag?.resumeBatchEmbed()
  }

  const handleCancelBatchEmbed = async () => {
    if (
      !(await confirm(
        t(
          'settings.rag_batch_embed_cancel_confirm',
          '取消后将停止尚未开始的嵌入，已经写入的向量会保留。确定取消？'
        ),
        t('common.warning', '警告')
      ))
    ) {
      return
    }
    patchCachedRagActiveState({ cancelling: true, paused: false })
    await (window as any).api?.rag?.cancelBatchEmbed()
  }

  const handleTriggerMigration = async () => {
    if (
      !(await confirm(
        t('settings.rag_trigger_migration', '执行向量库迁移') + '?',
        t('common.warning', '警告')
      ))
    )
      return
    setIsProcessing(true)
    patchCachedRagActiveState({ error: undefined })
    try {
      const result = await (window as any).api?.rag?.triggerMigration()
      patchCachedRagActiveState({ error: undefined })
      await fetchRagInfo()
      if (result?.aborted) {
        await reloadSettings?.()
      }
      // 迁移成功后立刻清掉「版本不匹配」标，避免 toast 已完成但卡片仍残留
      if (result?.outcome === 'completed' || result?.completed || result?.outcome === 'no_data') {
        setHasMismatchModel(false)
      }
      showMigrationResultToast(result, t, toast)
      await checkMigrationStatus()
    } catch (e: unknown) {
      const detail = localizeAiApiErrorMessage(extractIpcErrorMessage(e), t)
      setCachedRagActiveState({
        ...getCachedRagActiveState(),
        isRunning: false,
        type: 'idle',
        error: detail
      })
      toast.showError(
        t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', { message: detail })
      )
      await checkMigrationStatus()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestoreMigration = async () => {
    if (
      !(await confirm(
        t(
          'settings.rag_migration_restore_confirm',
          '确定要恢复迁移前的向量数据与嵌入模型吗？当前未完成的迁移进度将被放弃。'
        ),
        t('common.warning', '警告')
      ))
    ) {
      return
    }
    setIsProcessing(true)
    try {
      await (window as any).api?.rag?.restoreMigrationBackup()
      await fetchRagInfo()
      await reloadSettings?.()
      await checkMigrationStatus()
      toast.showSuccess(
        t('settings.rag_migration_restore_success', '已恢复迁移前的向量数据与嵌入模型。')
      )
    } catch (e: any) {
      toast.showError(
        t('settings.rag_migration_restore_failed', '恢复失败：{{message}}', {
          message: e?.message || String(e)
        })
      )
      await checkMigrationStatus()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResumeMigration = async () => {
    setIsProcessing(true)
    patchCachedRagActiveState({ error: undefined })
    try {
      const result = await (window as any).api?.rag?.resumeMigration()
      patchCachedRagActiveState({ error: undefined })
      await fetchRagInfo()
      if (result?.aborted) {
        await reloadSettings?.()
      }
      if (result?.outcome === 'completed' || result?.completed || result?.outcome === 'no_data') {
        setHasMismatchModel(false)
      }
      showMigrationResultToast(result, t, toast)
      await checkMigrationStatus()
    } catch (e: unknown) {
      const detail = localizeAiApiErrorMessage(extractIpcErrorMessage(e), t)
      setCachedRagActiveState({
        ...getCachedRagActiveState(),
        isRunning: false,
        type: 'idle',
        error: detail
      })
      toast.showError(
        t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', { message: detail })
      )
      await checkMigrationStatus()
    } finally {
      setIsProcessing(false)
    }
  }

  const waitForMigrationIdle = () =>
    new Promise<void>((resolve, reject) => {
      migrationWaitRef.current = { resolve, reject }
      if (migrationTimeoutRef.current) {
        clearTimeout(migrationTimeoutRef.current)
      }
      migrationTimeoutRef.current = setTimeout(() => {
        migrationTimeoutRef.current = null
        if (migrationWaitRef.current) {
          migrationWaitRef.current = null
          reject(new Error('Migration cancel timed out'))
        }
      }, 120_000)
    })

  const handleCancelMigration = async () => {
    if (
      !(await confirm(
        t(
          'settings.rag_migration_cancel_confirm',
          '确定要取消迁移并恢复迁移前的向量数据与嵌入模型吗？'
        ),
        t('common.warning', '警告')
      ))
    ) {
      return
    }

    const runningState = getCachedRagActiveState()
    patchCachedRagActiveState({
      ...runningState,
      isRunning: true,
      type: 'migration',
      statusKey: 'settings.rag_migration_aborting',
      statusText: t(
        'settings.rag_migration_aborting',
        '迁移失败，正在恢复迁移前的向量数据与嵌入模型...'
      )
    })
    setIsProcessing(true)

    try {
      await (window as any).api?.rag?.cancelMigration()
      if (runningState.isRunning && runningState.type === 'migration') {
        await Promise.race([waitForMigrationIdle(), new Promise((r) => setTimeout(r, 120_000))])
      }
      await fetchRagInfo()
      await reloadSettings?.()
      await refreshMigrationState()
      toast.showWarning(
        t(
          'settings.rag_migration_aborted_restored',
          '迁移已中止，已恢复迁移前的向量数据与嵌入模型配置。'
        )
      )
    } catch (e: any) {
      toast.showError(
        t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', {
          message: e?.message || String(e)
        })
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearAll = async (kinds: import('@baishou/shared').MemoryClearKind[]) => {
    if (!kinds.length) return
    setIsProcessing(true)
    try {
      const ragKinds =
        kinds.includes('life_graph') && !kinds.includes('graph_node')
          ? [...kinds, 'graph_node' as const]
          : kinds
      const needsRag = ragKinds.some((kind) => kind !== 'life_graph')
      await (window as any).api?.rag?.cancelBatchEmbed?.()
      if (needsRag) {
        await (window as any).api?.rag?.clearAll({ kinds: ragKinds })
      }
      if (kinds.includes('life_graph')) {
        await window.api.graph.clearLifeGraph()
      }
      await fetchRagInfo()
      toast.showSuccess(t('settings.rag_clear_all_done', '已清除所选记忆'))
    } catch (e: any) {
      toast.showError(
        t('settings.rag_clear_all_failed', '清除记忆失败：{{message}}', {
          message: e?.message || String(e)
        })
      )
      throw e
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    isProcessing,
    setIsProcessing,
    activeRagState,
    hasMismatchModel,
    migrationState,
    checkMigrationStatus,
    refreshMigrationState,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handlePauseBatchEmbed,
    handleResumeBatchEmbed,
    handleCancelBatchEmbed,
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll
  }
}
