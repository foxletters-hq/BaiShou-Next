import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import {
  classifyAiApiCallError,
  formatAiApiCallError,
  type EmbeddingMigrationStateView
} from '@baishou/shared'
import { showMigrationResultToast } from './migration-result-toast'
import {
  getCachedRagActiveState,
  patchCachedRagActiveState,
  setCachedRagActiveState,
  subscribeRagRuntime
} from '../rag-runtime-cache'

function localizeRagEmbedError(raw: string, t: (key: string, fallback: string) => string): string {
  const kind = classifyAiApiCallError({ message: raw, responseBody: raw })
  switch (kind) {
    case 'balance':
      return t('agent.error.quota', '模型服务商提示账号额度不足。')
    case 'auth':
      return t(
        'ai_config.error_no_model',
        '检测失败：可能是未配置有效的 Embedding 模型或服务未连通。'
      )
    case 'rate_limit':
      return t('agent.error.rate_limit', '请求过于频繁或超出并发限制，请稍后再试。')
    case 'network':
      return t('agent.error.network', '网络连接失败，请检查您的网络连接或代理设置。')
    default:
      return raw
  }
}

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

  const refreshMigrationState = useCallback(async () => {
    try {
      const state = await (window as any).api?.rag?.getMigrationState?.()
      if (state) setMigrationState(state)
    } catch {}
  }, [])

  useEffect(() => {
    void refreshMigrationState()
  }, [refreshMigrationState])

  useEffect(() => {
    if (!activeRagState.isRunning) {
      void refreshMigrationState()
      migrationWaitRef.current?.resolve()
      migrationWaitRef.current = null
    }
  }, [activeRagState.isRunning, refreshMigrationState])

  const checkMigrationStatus = async () => {
    try {
      const pending = await (window as any).api?.rag?.hasPendingMigration?.()
      const mismatch = await (window as any).api?.rag?.hasModelMismatch?.()
      setHasMismatchModel(!!pending || !!mismatch)
      await refreshMigrationState()
    } catch {}
  }

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
        t('settings.rag_batch_embed', '全量扫描未索引日记') + '?',
        t('common.warning', '警告')
      ))
    )
      return
    setIsProcessing(true)
    patchCachedRagActiveState({ error: undefined })
    try {
      await (window as any).api?.rag?.triggerBatchEmbed()
      patchCachedRagActiveState({ error: undefined })
      await fetchRagInfo()
      await reloadSettings?.()
      toast.showSuccess(t('settings.rag_batch_embed_done', '批量嵌入已完成'))
    } catch (e: unknown) {
      const raw = extractIpcErrorMessage(e)
      const detail = localizeRagEmbedError(raw, t)
      setCachedRagActiveState({
        ...getCachedRagActiveState(),
        isRunning: false,
        type: 'idle',
        error: detail
      })
      toast.showError(
        t('settings.rag_batch_embed_failed', '批量嵌入失败：{{message}}', { message: detail })
      )
    } finally {
      setIsProcessing(false)
    }
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
      showMigrationResultToast(result, t, toast)
      await refreshMigrationState()
    } catch (e: unknown) {
      const detail = localizeRagEmbedError(extractIpcErrorMessage(e), t)
      setCachedRagActiveState({
        ...getCachedRagActiveState(),
        isRunning: false,
        type: 'idle',
        error: detail
      })
      toast.showError(
        t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', { message: detail })
      )
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
      await refreshMigrationState()
      toast.showSuccess(
        t('settings.rag_migration_restore_success', '已恢复迁移前的向量数据与嵌入模型。')
      )
    } catch (e: any) {
      toast.showError(
        t('settings.rag_migration_restore_failed', '恢复失败：{{message}}', {
          message: e?.message || String(e)
        })
      )
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
      showMigrationResultToast(result, t, toast)
      await refreshMigrationState()
    } catch (e: unknown) {
      const detail = localizeRagEmbedError(extractIpcErrorMessage(e), t)
      setCachedRagActiveState({
        ...getCachedRagActiveState(),
        isRunning: false,
        type: 'idle',
        error: detail
      })
      toast.showError(
        t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', { message: detail })
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const waitForMigrationIdle = () =>
    new Promise<void>((resolve, reject) => {
      migrationWaitRef.current = { resolve, reject }
      setTimeout(() => {
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
    setIsProcessing(true)
    try {
      await (window as any).api?.rag?.cancelMigration()
      if (activeRagState.isRunning && activeRagState.type === 'migration') {
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

  const handleClearAll = async (prompt: any) => {
    const phrase = t('settings.rag_clear_all_confirm_phrase', '确认清除')
    const confirmText = await prompt(
      t(
        'settings.rag_clear_all_confirm',
        '请在下方输入「{{phrase}}」以确认清空所有RAG记忆：'
      ).replace('{{phrase}}', phrase),
      '',
      t('settings.rag_clear_all', '清空现有记忆')
    )
    if (confirmText !== phrase) {
      if (confirmText !== null) {
        toast.showWarning(t('settings.rag_clear_all_mismatch', '输入内容不匹配，操作已取消。'))
      }
      return
    }
    setIsProcessing(true)
    try {
      await (window as any).api?.rag?.clearAll()
      await fetchRagInfo()
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
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll
  }
}
