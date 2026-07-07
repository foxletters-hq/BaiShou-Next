import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { useAgentStore } from '@baishou/store'
import { truncateSessionAfterOrderIndex, truncateOptionsWithDiskFlush } from '@baishou/ai'

import { useBaishou } from '../providers/BaishouProvider'
import { runMobileAgentDbWrite } from '../services/mobile-agent-db-write.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'
import {
  type AgentStreamRefs,
  type RefreshSessionMessagesFn,
  type TokenUsage
} from './useAgentStream-types'

interface UseAgentStreamFinishOptions {
  refs: AgentStreamRefs
  refreshSessionMessages?: RefreshSessionMessagesFn
  setTokenUsage: Dispatch<SetStateAction<TokenUsage>>
  setIsStreaming: (value: boolean) => void
  isActiveSession: (sessionId: string) => boolean
  flushStreamingDisplayBuffers: () => void
  beginStreamBridgeHandoff: () => void
  releaseRetryAction: () => void
}

export function useAgentStreamFinish({
  refs,
  refreshSessionMessages,
  setTokenUsage,
  setIsStreaming,
  isActiveSession,
  flushStreamingDisplayBuffers,
  beginStreamBridgeHandoff,
  releaseRetryAction
}: UseAgentStreamFinishOptions) {
  const { addMessage, clearSession, setLoading } = useAgentStore()
  const { services } = useBaishou()

  const {
    reloadInFlightRef,
    retryEpochRef,
    streamFinalizeLockRef,
    finishStreamPassRef,
    finishStreamInFlightRef,
    streamAbortRef,
    streamingTextDisplayRef,
    streamingReasoningDisplayRef,
    pendingRetryReleaseEpochRef,
    isStreamingRef
  } = refs

  const syncTokenUsageFromSession = useCallback(
    async (sessionId: string) => {
      if (!services?.sessionRepo) return
      if (!isActiveSession(sessionId)) return
      const session = await services.sessionRepo.getSessionById(sessionId)
      if (!session) return
      if (!isActiveSession(sessionId)) return
      setTokenUsage({
        inputTokens: session.totalInputTokens ?? 0,
        outputTokens: session.totalOutputTokens ?? 0,
        cacheReadInputTokens: session.totalCacheReadInputTokens ?? 0,
        cacheWriteInputTokens: session.totalCacheWriteInputTokens ?? 0,
        totalCostMicros: session.totalCostMicros ?? 0
      })
    },
    [services, isActiveSession, setTokenUsage]
  )

  const reloadMessagesFromDb = useCallback(
    async (
      sessionId: string,
      options?: {
        preserveWindow?: boolean
        retryCount?: number
        waitForLatestUsage?: boolean
        commitToUi?: boolean
      }
    ): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const commitToUi = options?.commitToUi ?? isActiveSession(sessionId)

        if (refreshSessionMessages) {
          const ok = await refreshSessionMessages(sessionId, { ...options, commitToUi })
          if (!ok) return false
        } else if (services && commitToUi) {
          const [storageRoot, attachmentsBasePath] = await Promise.all([
            services.pathService.getRootDirectory(),
            services.pathService.getAttachmentsBaseDirectory()
          ])
          const rows = await services.sessionManager.getMessagesBySession(sessionId, 100)
          clearSession()
          const seen = new Set<string>()
          for (const row of rows) {
            if (seen.has(row.id)) continue
            seen.add(row.id)
            addMessage(mapSessionMessageFromDb(row as any, { storageRoot, attachmentsBasePath }))
          }
        }

        if (commitToUi && isActiveSession(sessionId)) {
          await syncTokenUsageFromSession(sessionId)
        }

        return true
      }

      const prev = reloadInFlightRef.current
      const next = (async () => {
        if (prev) {
          try {
            await prev
          } catch {
            /* ignore */
          }
        }
        return run()
      })()
      reloadInFlightRef.current = next
      try {
        return await next
      } finally {
        if (reloadInFlightRef.current === next) {
          reloadInFlightRef.current = null
        }
      }
    },
    [
      refreshSessionMessages,
      services,
      clearSession,
      addMessage,
      syncTokenUsageFromSession,
      isActiveSession,
      reloadInFlightRef
    ]
  )

  const truncateSessionAndSyncUi = useCallback(
    async (sessionId: string, cutoffOrderIndex: number, epoch: number): Promise<boolean> => {
      if (!services?.snapshotRepo) return false
      if (epoch !== retryEpochRef.current) return false

      await runMobileAgentDbWrite(`truncateSession(${sessionId})`, async (runtime) => {
        if (!runtime.snapshotRepo) {
          throw new Error('Snapshot repository unavailable')
        }
        await truncateSessionAfterOrderIndex(
          runtime.sessionRepo,
          runtime.snapshotRepo,
          sessionId,
          cutoffOrderIndex,
          truncateOptionsWithDiskFlush(runtime.sessionManager)
        )
      })
      if (epoch !== retryEpochRef.current) return false

      const synced = await reloadMessagesFromDb(sessionId, { preserveWindow: false })
      if (epoch !== retryEpochRef.current) return false
      return synced
    },
    [services, reloadMessagesFromDb, retryEpochRef]
  )

  const finishStream = useCallback(
    async (
      sessionId: string,
      options?: { waitForLatestUsage?: boolean; releaseRetryEpoch?: number }
    ) => {
      const finishPass = ++finishStreamPassRef.current
      const releaseEpoch = options?.releaseRetryEpoch ?? null

      const runFinalize = async () => {
        streamFinalizeLockRef.current = sessionId

        setLoading(false)
        streamAbortRef.current = null

        const hasBufferedOutput =
          Boolean(streamingTextDisplayRef.current?.getFullText().trim()) ||
          Boolean(streamingReasoningDisplayRef.current?.getFullText().trim())
        if (hasBufferedOutput && isActiveSession(sessionId)) {
          flushStreamingDisplayBuffers()
        }

        try {
          try {
            await services?.sessionManager.flushSessionToDisk(sessionId)
          } catch {
            /* ignore */
          }

          if (!isActiveSession(sessionId)) return

          let reloaded = await reloadMessagesFromDb(sessionId, {
            preserveWindow: true,
            retryCount: 5,
            waitForLatestUsage: options?.waitForLatestUsage ?? false,
            commitToUi: true
          })

          if (!reloaded && isActiveSession(sessionId)) {
            reloaded = await reloadMessagesFromDb(sessionId, {
              preserveWindow: true,
              retryCount: 2,
              waitForLatestUsage: false,
              commitToUi: true
            })
          }

          if (!reloaded && isActiveSession(sessionId)) {
            await syncTokenUsageFromSession(sessionId)
          }
        } catch (e) {
          console.error('Failed to finish stream', e)
          if (isActiveSession(sessionId)) {
            await syncTokenUsageFromSession(sessionId)
          }
        } finally {
          if (streamFinalizeLockRef.current === sessionId) {
            streamFinalizeLockRef.current = null
          }

          if (finishPass !== finishStreamPassRef.current) {
            if (releaseEpoch !== null && pendingRetryReleaseEpochRef.current === releaseEpoch) {
              releaseRetryAction()
            }
          } else {
            beginStreamBridgeHandoff()
            isStreamingRef.current = false
            setIsStreaming(false)
            if (releaseEpoch !== null && pendingRetryReleaseEpochRef.current === releaseEpoch) {
              releaseRetryAction()
            }
          }
        }
      }

      const prev = finishStreamInFlightRef.current
      const task = (prev ? prev.then(runFinalize, runFinalize) : runFinalize()).finally(() => {
        if (finishStreamInFlightRef.current === task) {
          finishStreamInFlightRef.current = null
        }
      })
      finishStreamInFlightRef.current = task
      return task
    },
    [
      finishStreamPassRef,
      streamFinalizeLockRef,
      streamAbortRef,
      streamingTextDisplayRef,
      streamingReasoningDisplayRef,
      flushStreamingDisplayBuffers,
      reloadMessagesFromDb,
      beginStreamBridgeHandoff,
      releaseRetryAction,
      setLoading,
      setIsStreaming,
      services,
      syncTokenUsageFromSession,
      isActiveSession,
      pendingRetryReleaseEpochRef,
      isStreamingRef,
      finishStreamInFlightRef
    ]
  )

  return {
    syncTokenUsageFromSession,
    reloadMessagesFromDb,
    truncateSessionAndSyncUi,
    finishStream
  }
}
