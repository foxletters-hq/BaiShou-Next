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
      cancelling: running && isBatchEmbedAbortRequested()
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
    replayLastBatchProgress(i18n.t('settings.rag_batch_embed_cancelling', '正在取消索引…'))
    return { ok: true }
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
        if (!force && now - lastAt < 800) return
        lastAt = now
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('diary:sync-event', { type: 'embed-pending-changed' })
        }
      }
    })()

    try {
      const { getOrganizePendingSnapshot, invalidatePendingEmbedCountsCache } =
        await import('../services/pending-embed-counts.service')
      invalidatePendingEmbedCountsCache()
      sendProgress(0, 1, i18n.t('settings.rag_batch_embed_starting', '正在开始索引…'), {
        phase: 'starting'
      })
      const counts = await getOrganizePendingSnapshot()
      let phases = phaseCountsFromPending(counts)
      const overallTotal = overallFromPhaseCounts(phases).total
      sendProgress(0, overallTotal, i18n.t('settings.rag_batch_embed_starting', '正在开始索引…'), {
        phase: firstActivePhase(counts),
        phases
      })

      const diaryResult = await runControlledDiaryBatchEmbed({
        groupId: 'diary_batch',
        onProgress: ({ completed, total, statusText }) => {
          phases = applyFrozenPhaseProgress(phases, 'diary', {
            completed,
            total
          })
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

      if (diaryResult.failed > 0 && diaryResult.embedded === 0 && diaryResult.total > 0) {
        const ragConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
        const message =
          diaryResult.lastError ||
          i18n.t(
            'settings.rag_diary_embed_api_unavailable',
            '嵌入接口不可用，没有写入任何日记向量。请检查嵌入模型的接口地址。'
          )
        await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, message))
        throw new Error(message)
      }

      const { runManualPendingEmbedFill } = await import('../services/pending-embed-fill.service')
      const fillResult = await runManualPendingEmbedFill({
        counts,
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
      endBatchEmbedControl()
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('agent:rag-progress', {
          isRunning: false,
          type: 'idle',
          progress: 0,
          total: 0,
          paused: false,
          cancelling: false,
          error: err.message
        })
      }
      throw err
    } finally {
      endBatchEmbedControl()
    }
  })
}
