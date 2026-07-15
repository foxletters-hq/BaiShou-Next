import { useCallback, useRef, useState } from 'react'
import type { i18n as I18nInstance } from 'i18next'
import { SummaryType, logger } from '@baishou/shared'
import { resolveMobileSummaryGenerateOptions } from '../services/mobile-summary-generate-options'
import { appendVaultDebugLog } from '../services/summary-debug-log.util'
import type { useBaishou } from '../providers/BaishouProvider'

export interface SummaryMissingItem {
  type: string
  startDate: string
  endDate: string
  label?: string
  dateRangeStr?: string
}

export interface SummaryGenerationState {
  progress: number
  phase: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

interface QueueItem {
  id: string
  target: SummaryMissingItem
  progress: number
  phaseIdx: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

type BaishouServices = NonNullable<ReturnType<typeof useBaishou>['services']>

export function useSummaryGenerationQueue(options: {
  dbReady: boolean
  services: BaishouServices | null
  i18n: I18nInstance
  onRefreshData: () => Promise<void>
}) {
  const { dbReady, services, i18n, onRefreshData } = options

  const [generationStates, setGenerationStates] = useState<Record<string, SummaryGenerationState>>(
    {}
  )
  const [isGenerating, setIsGenerating] = useState(false)

  const queueRef = useRef<QueueItem[]>([])
  const activeCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const concurrencyLimitRef = useRef(1)
  const isSchedulingRef = useRef(false)
  /** 本轮队列仅提示一次伙伴回退，避免批量任务刷屏 */
  const assistantFallbackNotifiedRef = useRef(false)
  const [assistantFallbackTick, setAssistantFallbackTick] = useState(0)

  const broadcastState = useCallback(() => {
    const states: Record<string, SummaryGenerationState> = {}
    queueRef.current.forEach((item) => {
      states[item.id] = {
        progress: item.progress,
        phase: item.phaseIdx,
        status: item.status,
        error: item.error
      }
    })
    setGenerationStates(states)
  }, [])

  const processTask = useCallback(
    async (task: QueueItem) => {
      const signal = abortControllerRef.current?.signal
      const taskStartTime = Date.now()

      try {
        logger.info(`[SummaryQueue] Starting task: ${task.id}`)
        task.status = 'running'
        task.phaseIdx = 0
        task.progress = 5
        broadcastState()

        await new Promise((r) => setTimeout(r, 500))
        if (signal?.aborted) {
          throw new Error(
            i18n.t('auto.apps.mobile.src.hooks.useSummaryData.L315', '用户取消了生成')
          )
        }

        if (!services) throw new Error('Services not ready')

        const target = {
          type: task.target.type as SummaryType,
          startDate: new Date(task.target.startDate),
          endDate: new Date(task.target.endDate),
          label: task.target.label ?? ''
        }

        const { generateOptions, providerIdForLog, usedDialogueFallback, fellBackToPrompt } =
          await resolveMobileSummaryGenerateOptions({
            settingsManager: services.settingsManager,
            assistantManager: services.assistantManager,
            buildSharedContext: services.buildSharedContext,
            periodStart: target.startDate
          })

        if (fellBackToPrompt && !assistantFallbackNotifiedRef.current) {
          assistantFallbackNotifiedRef.current = true
          setAssistantFallbackTick((n) => n + 1)
          logger.warn('[SummaryQueue] Fell back to prompt mode for task:', task.id)
        }

        const finalModelId = generateOptions.modelId ?? 'gpt-4'

        await appendVaultDebugLog(services.pathService, services.fileSystem, {
          timestamp: new Date().toISOString(),
          event: 'start',
          taskId: task.id,
          targetType: task.target.type,
          modelId: finalModelId,
          providerId: providerIdForLog,
          usedDialogueFallback: usedDialogueFallback ?? false,
          hasSharedMemoryInject: !!generateOptions.sharedContextText,
          hasSystemPrompt: !!generateOptions.systemPrompt
        })

        const stream = services.summaryGenerator.generate(target, generateOptions)

        let finalContent = ''

        for await (const chunk of stream) {
          if (signal?.aborted) {
            task.status = 'error'
            task.error = i18n.t('auto.apps.mobile.src.hooks.useSummaryData.L356', '用户取消了生成')
            broadcastState()
            break
          }

          if (chunk.includes('STATUS:reading_data')) {
            task.phaseIdx = 1
            task.progress = 25
            broadcastState()
            await new Promise((r) => setTimeout(r, 600))
          } else if (chunk.includes('STATUS:thinking_via_')) {
            logger.info(`[SummaryQueue] Task ${task.id} entered thinking phase: ${chunk}`)
            task.phaseIdx = 2
            task.progress = 50
          } else if (chunk.includes('STATUS:generation_failed_error')) {
            const cleanMsg = chunk.replace('STATUS:generation_failed_error:', '').trim()
            throw new Error(cleanMsg)
          } else if (chunk.includes('STATUS:no_data_error')) {
            logger.warn(`[SummaryQueue] Task ${task.id} skipped: no context data available`)
            task.status = 'completed'
            task.progress = 100
            task.phaseIdx = 4
            broadcastState()
            return
          } else if (!chunk.startsWith('STATUS:')) {
            const textLength = chunk.length
            const stepSize = 12
            let currentIdx = 0
            while (currentIdx < textLength) {
              if (signal?.aborted) break
              const nextPart = chunk.substring(currentIdx, currentIdx + stepSize)
              finalContent += nextPart
              currentIdx += stepSize
              task.phaseIdx = 3
              task.progress = 85
              broadcastState()
              await new Promise((r) => setTimeout(r, 30))
            }
          }
          broadcastState()
        }

        if (task.status === 'error') return

        if (finalContent.trim().length > 0) {
          task.progress = 95
          broadcastState()
          await new Promise((r) => setTimeout(r, 600))

          logger.info(
            `[SummaryQueue] Saving generated summary for task: ${task.id}, content length: ${finalContent.length}`
          )
          await services.summaryManager.save({
            type: task.target.type as SummaryType,
            startDate: new Date(task.target.startDate),
            endDate: new Date(task.target.endDate),
            content: finalContent
          })

          task.status = 'completed'
          task.progress = 100
          task.phaseIdx = 4
          broadcastState()
          logger.info(`[SummaryQueue] Task completed successfully: ${task.id}`)

          await appendVaultDebugLog(services.pathService, services.fileSystem, {
            timestamp: new Date().toISOString(),
            event: 'success',
            taskId: task.id,
            durationMs: Date.now() - taskStartTime,
            contentLength: finalContent.length
          })

          await onRefreshData()
        } else {
          throw new Error('Generated content was empty.')
        }
      } catch (e: unknown) {
        const err = e as { message?: string; stack?: string }
        logger.error(`[SummaryQueue] Task ${task.id} failed:`, err)
        task.status = 'error'
        task.error = err.message || String(e)
        broadcastState()

        if (services) {
          await appendVaultDebugLog(services.pathService, services.fileSystem, {
            timestamp: new Date().toISOString(),
            event: 'error',
            taskId: task.id,
            durationMs: Date.now() - taskStartTime,
            errorMessage: err.message || String(e),
            errorStack: err.stack || ''
          })
        }
      }
    },
    [broadcastState, i18n, onRefreshData, services]
  )

  const scheduleNext = useCallback(async () => {
    if (isSchedulingRef.current) return
    isSchedulingRef.current = true

    try {
      while (
        activeCountRef.current < concurrencyLimitRef.current &&
        queueRef.current.some((q) => q.status === 'pending')
      ) {
        const next = queueRef.current.find((q) => q.status === 'pending')
        if (!next) break

        next.status = 'running'
        next.progress = 5
        activeCountRef.current++
        broadcastState()

        processTask(next).finally(() => {
          activeCountRef.current--
          broadcastState()

          if (!abortControllerRef.current?.signal.aborted) {
            void scheduleNext()
          }

          if (activeCountRef.current === 0) {
            abortControllerRef.current = null
            setIsGenerating(false)
            void onRefreshData()

            setTimeout(() => {
              const hasFinished = queueRef.current.some(
                (q) => q.status === 'completed' || q.status === 'error'
              )
              if (hasFinished) {
                queueRef.current = queueRef.current.filter(
                  (q) => q.status === 'pending' || q.status === 'running'
                )
                broadcastState()
              }
            }, 3000)
          }
        })
      }
    } finally {
      isSchedulingRef.current = false
    }
  }, [broadcastState, onRefreshData, processTask])

  const queueGeneration = useCallback(
    async (items: SummaryMissingItem[], concurrency?: number) => {
      if (!dbReady || !services) return

      if (concurrency !== undefined) {
        concurrencyLimitRef.current = Math.max(1, Math.min(5, concurrency))
      }

      let added = 0
      for (const item of items) {
        const uKey = `${item.type}_${new Date(item.startDate).getTime()}`
        if (!queueRef.current.find((q) => q.id === uKey)) {
          queueRef.current.push({
            id: uKey,
            target: item,
            progress: 0,
            phaseIdx: 0,
            status: 'pending'
          })
          added++
        }
      }

      if (added > 0) {
        assistantFallbackNotifiedRef.current = false
        if (!abortControllerRef.current) {
          abortControllerRef.current = new AbortController()
        }
        setIsGenerating(true)
        broadcastState()
        await scheduleNext()
      }
    },
    [broadcastState, dbReady, scheduleNext, services]
  )

  const stopGeneration = useCallback(async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    for (const item of queueRef.current) {
      if (item.status === 'running' || item.status === 'pending') {
        item.status = 'error'
        item.error = i18n.t('auto.apps.mobile.src.hooks.useSummaryData.L545', '用户取消了生成')
      }
    }

    queueRef.current = queueRef.current.filter((q) => q.status !== 'error')
    activeCountRef.current = 0
    setIsGenerating(false)
    broadcastState()
  }, [broadcastState, i18n])

  const generateSummary = useCallback(
    async (type: string, dateRange: { startDate: string; endDate: string }) => {
      if (!dbReady || !services) return
      await queueGeneration([{ type, startDate: dateRange.startDate, endDate: dateRange.endDate }])
    },
    [dbReady, queueGeneration, services]
  )

  const setConcurrency = useCallback((limit: number) => {
    concurrencyLimitRef.current = Math.max(1, Math.min(5, limit))
  }, [])

  return {
    generationStates,
    isGenerating,
    assistantFallbackTick,
    queueGeneration,
    stopGeneration,
    generateSummary,
    setConcurrency
  }
}
