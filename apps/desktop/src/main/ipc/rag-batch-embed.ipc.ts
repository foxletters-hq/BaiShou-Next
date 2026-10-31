import i18n from 'i18next'
import { ipcMain, BrowserWindow } from 'electron'
import { getEmbeddingConfig } from './rag.ipc'
import { settingsManager } from './settings.ipc'
import {
  beginBatchEmbedControl,
  endBatchEmbedControl,
  isBatchEmbedAbortRequested,
  isBatchEmbedAbortedError,
  isBatchEmbedPaused,
  isBatchEmbedSessionActive,
  requestBatchEmbedCancel,
  requestBatchEmbedPause,
  requestBatchEmbedResume
} from '../services/batch-embed-control.service'
import { runControlledDiaryBatchEmbed } from '../services/controlled-diary-batch-embed.service'
import {
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure,
  markRagDiaryEmbedFailure,
  toSerializableAiError,
  applyFrozenPhaseProgress,
  firstActivePhase,
  overallFromPhaseCounts,
  patchPhaseCounts,
  phaseCountsFromPending,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind,
  type RagConfig
} from '@baishou/shared'

export function registerRagBatchEmbedIpc(): void {
  const config = getEmbeddingConfig()

  type BatchProgressExtras = {
    running?: boolean
    phase?: RagBatchEmbedPhaseKind
    phases?: RagBatchEmbedPhaseCounts
    error?: string
  }
  const lastBatchProgress: {
    current: {
      progress: number
      total: number
      statusText: string
      extras?: BatchProgressExtras
    } | null
  } = { current: null }

  const sendBatchProgress = (
    progress: number,
    total: number,
    statusText: string,
    extras?: BatchProgressExtras
  ) => {
    lastBatchProgress.current = { progress, total, statusText, extras }
    const running = extras?.running ?? true
    const payload = {
      isRunning: running,
      type: running ? 'batchEmbed' : 'idle',
      progress,
      total,
      statusText,
      phase: extras?.phase,
      phases: extras?.phases,
      paused: running && isBatchEmbedPaused(),
      cancelling: running && isBatchEmbedAbortRequested(),
      error: extras?.error
    }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('agent:rag-progress', payload)
    }
  }

  const replayLastBatchProgress = (statusText?: string) => {
    const last = lastBatchProgress.current
    if (last) {
      sendBatchProgress(last.progress, last.total, statusText ?? last.statusText, last.extras)
      return
    }
    sendBatchProgress(0, 0, statusText ?? i18n.t('settings.rag_indexing', '正在补齐嵌入…'), {
      running: true,
      phase: 'starting'
    })
  }

  ipcMain.handle('rag:pause-batch-embed', async () => {
    requestBatchEmbedPause()
    replayLastBatchProgress()
    return { ok: true }
  })

  ipcMain.handle('rag:resume-batch-embed', async () => {
    requestBatchEmbedResume()
    replayLastBatchProgress()
    return { ok: true }
  })

  ipcMain.handle('rag:cancel-batch-embed', async () => {
    requestBatchEmbedCancel()
    try {
      // 统一整理里抽图队列与嵌入是两条流水，取消时必须一起停，
      // 否则嵌入停了、抽图还在后台跑，界面会一直显示「正在整理记忆」。
      const { GraphExtractQueueService } = await import('../services/graph-extract-queue.service')
      GraphExtractQueueService.getInstance().stop()
    } catch (error) {
      console.warn('Failed to stop graph extract queue on batch embed cancel:', error)
    }
    replayLastBatchProgress(i18n.t('settings.rag_batch_embed_cancelling', '正在取消索引…'))
    return { ok: true }
  })

  ipcMain.handle('rag:get-batch-embed-state', async () => {
    const running = isBatchEmbedSessionActive()
    const last = lastBatchProgress.current
    if (!running) {
      return {
        isRunning: false,
        type: 'idle',
        progress: last?.progress ?? 0,
        total: last?.total ?? 0,
        statusText: '',
        phase: last?.extras?.phase,
        phases: last?.extras?.phases,
        paused: false,
        cancelling: false,
        error: last?.extras?.error
      }
    }
    return {
      isRunning: true,
      type: 'batchEmbed',
      progress: last?.progress ?? 0,
      total: last?.total ?? 0,
      statusText: last?.statusText || i18n.t('settings.rag_batch_embed_starting', '正在开始索引…'),
      phase: last?.extras?.phase ?? 'starting',
      phases: last?.extras?.phases,
      paused: isBatchEmbedPaused(),
      cancelling: isBatchEmbedAbortRequested()
    }
  })

  ipcMain.handle('rag:trigger-batch-embed', async (_event) => {
    if (isBatchEmbedSessionActive()) {
      return { ok: false, alreadyRunning: true }
    }
    beginBatchEmbedControl()
    await config.load()
    const sendProgress = sendBatchProgress
    const notifyPendingChanged = (() => {
      let lastAt = 0
      return (force = false) => {
        const now = Date.now()
        // 整理进行中节流到 5000ms，防止渲染层高频触发待嵌入统计与图谱全量重刷占满主线程
        if (!force && now - lastAt < 5000) return
        lastAt = now
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('diary:sync-event', { type: 'embed-pending-changed' })
        }
      }
    })()

    try {
      try {
        const { GraphExtractQueueService } = await import('../services/graph-extract-queue.service')
        GraphExtractQueueService.getInstance().clearError()
      } catch {
        // ignore
      }
      const { getOrganizePendingSnapshot, invalidatePendingEmbedCountsCache } =
        await import('../services/pending-embed-counts.service')
      invalidatePendingEmbedCountsCache()
      sendProgress(0, 1, i18n.t('settings.rag_batch_embed_starting', '正在开始索引…'), {
        phase: 'starting',
        error: undefined
      })
      const counts = await getOrganizePendingSnapshot()
      let phases = phaseCountsFromPending(counts)
      const overallTotal = overallFromPhaseCounts(phases).total
      sendProgress(0, overallTotal, i18n.t('settings.rag_batch_embed_starting', '正在开始索引…'), {
        phase: firstActivePhase(counts),
        phases,
        error: undefined
      })

      const diaryResult = await runControlledDiaryBatchEmbed({
        groupId: 'diary_batch',
        onProgress: ({ completed, total, statusText }) => {
          let nextPhases = applyFrozenPhaseProgress(phases, 'diary', {
            completed,
            total
          })
          try {
            const { GraphExtractQueueService } = require('../services/graph-extract-queue.service')
            const queueState = GraphExtractQueueService.getInstance().getQueueState()
            if (queueState && queueState.items?.length > 0) {
              const completedExtract = queueState.completedCount
              if (completedExtract > 0) {
                nextPhases = applyFrozenPhaseProgress(nextPhases, 'graph_extract', {
                  completed: completedExtract,
                  total: Math.max(nextPhases.graphExtract.total, queueState.items.length)
                })
              }
            }
          } catch {
            // ignore
          }
          phases = nextPhases
          const overall = overallFromPhaseCounts(phases)
          sendProgress(
            overall.completed,
            overall.total,
            statusText || i18n.t('settings.rag_indexing_diary', '正在嵌入日记…'),
            {
              phase: 'diary',
              phases
            }
          )
        }
      })
      phases = patchPhaseCounts(phases, 'diary', {
        completed: diaryResult.embedded,
        total: diaryResult.total
      })

      if (diaryResult.failed > 0 && diaryResult.total > 0) {
        const message =
          diaryResult.lastError ||
          i18n.t(
            'settings.rag_diary_embed_api_unavailable',
            '嵌入接口不可用，没有写入任何日记向量。请检查嵌入模型的接口地址。'
          )
        if (diaryResult.embedded === 0) {
          const ragConfig =
            (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
          await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, message))
        }
        throw new Error(message)
      }

      const { runManualPendingEmbedFill } = await import('../services/pending-embed-fill.service')
      const fillResult = await runManualPendingEmbedFill({
        counts,
        skipProbe: diaryResult.embedded > 0 || (diaryResult.total > 0 && diaryResult.failed === 0),
        onProgress: ({ completed, total, statusText, phase, phases: nextPhases }) => {
          phases = nextPhases
          sendProgress(completed, total, statusText, { phase, phases: nextPhases })
          notifyPendingChanged()
        }
      })

      if (fillResult.skippedReason === 'adapter-unavailable' && counts.total > counts.diaries) {
        throw new Error(
          i18n.t(
            'settings.rag_embed_adapter_unavailable',
            '嵌入模型未就绪，无法补齐记忆、图谱节点和知识库'
          )
        )
      }

      invalidatePendingEmbedCountsCache()
      notifyPendingChanged(true)
      const ragConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
      if (diaryResult.failed === 0 && hasRagDiaryEmbedFailure(ragConfig)) {
        await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfig))
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
        }
      }

      const finished = overallFromPhaseCounts(phases)
      sendProgress(finished.completed, finished.total, '', {
        running: false,
        phase: 'finishing',
        phases
      })
      return {
        ok: true,
        graphUpdated: fillResult.graphUpdated,
        graphFailed: fillResult.graphFailed,
        graphTotal: fillResult.graphTotal
      }
    } catch (e: unknown) {
      if (isBatchEmbedAbortedError(e)) {
        try {
          const { invalidatePendingEmbedCountsCache } =
            await import('../services/pending-embed-counts.service')
          invalidatePendingEmbedCountsCache()
        } catch {
          // ignore
        }
        notifyPendingChanged(true)
        endBatchEmbedControl()
        const cancelledProgress = lastBatchProgress.current
        sendProgress(cancelledProgress?.progress ?? 0, cancelledProgress?.total ?? 0, '', {
          running: false,
          phase: cancelledProgress?.extras?.phase,
          phases: cancelledProgress?.extras?.phases
        })
        return { ok: true, cancelled: true }
      }
      console.error('Batch Embed failed:', e)
      const err = toSerializableAiError(e, 'Batch embed failed')
      try {
        const { GraphExtractQueueService } = await import('../services/graph-extract-queue.service')
        GraphExtractQueueService.getInstance().stop()
      } catch {
        // ignore
      }
      try {
        const { invalidatePendingEmbedCountsCache } =
          await import('../services/pending-embed-counts.service')
        invalidatePendingEmbedCountsCache()
      } catch {
        // ignore
      }
      notifyPendingChanged(true)
      endBatchEmbedControl()
      const failedProgress = lastBatchProgress.current
      sendProgress(failedProgress?.progress ?? 0, failedProgress?.total ?? 0, '', {
        running: false,
        phase: failedProgress?.extras?.phase,
        phases: failedProgress?.extras?.phases,
        error: err.message
      })
      throw err
    } finally {
      try {
        const {
          clearDesktopDiaryGraphFollowPendingCache
        } = require('../services/diary-graph-follow-after-embed.service')
        clearDesktopDiaryGraphFollowPendingCache()
      } catch {
        // ignore
      }
      endBatchEmbedControl()
    }
  })
}
