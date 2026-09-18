import { logger } from '@baishou/shared'
import type { SessionRepository } from '@baishou/database'
import { assembleAssistantPersistParts } from './assemble-assistant-persist-parts'
import { resolveAssistantParentOrderIndex } from './agent-session-persist.utils'
import type { StreamAccumulator } from './stream-accumulator'
import {
  shouldFlushStreamingAssistant,
  streamingAssistantSnapshotKey,
  type StreamingAssistantFlushReason
} from './streaming-assistant-flush.util'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface StreamingAssistantCheckpointSnapshot {
  accumulator: StreamAccumulator
  agentGateParts?: unknown[]
  fileChangeParts?: unknown[]
  userConfig?: Record<string, unknown>
}

export class StreamingAssistantCheckpoint {
  assistantMessageId: string | null = null
  private lastFlushAt: number | null = null
  private lastSnapshotKey = ''
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly deps: {
      sessionId: string
      sessionRepo: SessionRepository
      userMessageId?: string
      skipUserMessageRecording?: boolean
      providerId: string
      modelId: string
      getSnapshot: () => StreamingAssistantCheckpointSnapshot
    }
  ) {}

  schedule(reason: StreamingAssistantFlushReason, now = Date.now()): void {
    this.queue = this.queue
      .then(() => this.flushIfNeeded(reason, now))
      .catch((error: unknown) => {
        logger.warn('[StreamingAssistantCheckpoint] flush failed:', error as Error)
      })
  }

  async drain(): Promise<string | null> {
    await this.queue
    return this.assistantMessageId
  }

  async discard(): Promise<void> {
    await this.queue
    const id = this.assistantMessageId
    if (!id) return
    await this.deps.sessionRepo.deleteMessage(this.deps.sessionId, id)
    this.assistantMessageId = null
  }

  private async flushIfNeeded(reason: StreamingAssistantFlushReason, now: number): Promise<void> {
    const snapshot = this.deps.getSnapshot()
    const key = streamingAssistantSnapshotKey({
      text: snapshot.accumulator.sanitizedText,
      reasoning: snapshot.accumulator.reasoning,
      toolCount: snapshot.accumulator.toolCalls.length,
      fileChangeCount: snapshot.fileChangeParts?.length ?? 0,
      gateCount: snapshot.agentGateParts?.length ?? 0
    })
    const shouldWrite = shouldFlushStreamingAssistant({
      reason,
      hasNewContentSinceFlush: key !== this.lastSnapshotKey,
      lastFlushAt: this.lastFlushAt,
      now
    })
    if (!shouldWrite) return

    const assistantMsgId = this.assistantMessageId ?? generateUUID()
    const parts = assembleAssistantPersistParts({
      accumulator: snapshot.accumulator,
      assistantMsgId,
      sessionId: this.deps.sessionId,
      userConfig: snapshot.userConfig,
      agentGateParts: snapshot.agentGateParts,
      fileChangeParts: snapshot.fileChangeParts,
      includeInProgressMarker: true
    })
    if (parts.length === 0) return

    const userOrderIndex = await resolveAssistantParentOrderIndex(
      this.deps.sessionRepo,
      this.deps.sessionId,
      {
        skipUserMessageRecording: this.deps.skipUserMessageRecording,
        userMessageId: this.deps.userMessageId
      }
    )

    if (!this.assistantMessageId) {
      await this.deps.sessionRepo.insertMessageWithParts(
        {
          id: assistantMsgId,
          sessionId: this.deps.sessionId,
          role: 'assistant',
          orderIndex: userOrderIndex + 1,
          providerId: this.deps.providerId,
          modelId: this.deps.modelId
        },
        parts
      )
      this.assistantMessageId = assistantMsgId
    } else {
      await this.deps.sessionRepo.replaceMessageParts(assistantMsgId, this.deps.sessionId, parts)
    }

    this.lastFlushAt = now
    this.lastSnapshotKey = key
  }
}
