import type { IStreamEmitter, StreamFinishPayload } from '@baishou/ai'
import {
  appendTimelineReasoning,
  appendTimelineText,
  appendTimelineToolStart,
  completeTimelineTool,
  logger,
  type AgentStreamTimelineItem
} from '@baishou/shared'

export interface ActiveMainStreamSnapshot {
  sessionId: string
  isStreaming: boolean
  text: string
  reasoning: string
  timeline: AgentStreamTimelineItem[]
  activeTool: { name: string; args: unknown; callId?: string } | null
  activeToolStartTime?: number
  completedTools: Array<{
    name: string
    startTime: number
    durationMs: number
    callId?: string
  }>
  pendingEmojis: Array<{ emojiId: string }>
}

const activeStreamSnapshots = new Map<string, ActiveMainStreamSnapshot>()

function ensureActiveMainStreamSnapshot(sessionId: string): ActiveMainStreamSnapshot {
  let snap = activeStreamSnapshots.get(sessionId)
  if (!snap) {
    snap = {
      sessionId,
      isStreaming: true,
      text: '',
      reasoning: '',
      timeline: [],
      activeTool: null,
      completedTools: [],
      pendingEmojis: []
    }
    activeStreamSnapshots.set(sessionId, snap)
  }
  return snap
}

export function beginMainStreamSnapshot(sessionId: string): void {
  if (!sessionId) return
  activeStreamSnapshots.set(sessionId, {
    sessionId,
    isStreaming: true,
    text: '',
    reasoning: '',
    timeline: [],
    activeTool: null,
    completedTools: [],
    pendingEmojis: []
  })
}

export function clearMainStreamSnapshot(sessionId?: string): void {
  if (!sessionId) {
    activeStreamSnapshots.clear()
    return
  }
  activeStreamSnapshots.delete(sessionId)
}

export function getActiveMainStreamSnapshot(sessionId: string): ActiveMainStreamSnapshot | null {
  if (!sessionId) return null
  return activeStreamSnapshots.get(sessionId) ?? null
}

function extractEmojiIdFromToolArgs(args: unknown): string | null {
  if (typeof args === 'object' && args !== null) {
    const id = (args as Record<string, unknown>).emoji_id
    return typeof id === 'string' && id.length > 0 ? id : null
  }
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args)
      return typeof parsed?.emoji_id === 'string' && parsed.emoji_id.length > 0
        ? parsed.emoji_id
        : null
    } catch {
      return args.length > 0 ? args : null
    }
  }
  return null
}

export class ElectronStreamEmitter implements IStreamEmitter {
  constructor(private readonly event: Electron.IpcMainInvokeEvent) {}

  private safeSend(channel: string, payload: unknown) {
    if (this.event.sender && !this.event.sender.isDestroyed()) {
      this.event.sender.send(channel, payload)
    }
  }

  sendChunk(sessionId: string, chunk: string) {
    const delta = chunk ?? ''
    const snap = ensureActiveMainStreamSnapshot(sessionId)
    snap.text += delta
    appendTimelineText(snap.timeline, delta)
    this.safeSend('agent:stream-chunk', { sessionId, chunk })
  }

  sendReasoningChunk(sessionId: string, chunk: string) {
    const delta = chunk ?? ''
    const snap = ensureActiveMainStreamSnapshot(sessionId)
    snap.reasoning += delta
    appendTimelineReasoning(snap.timeline, delta)
    this.safeSend('agent:reasoning-chunk', { sessionId, chunk })
  }

  sendToolStart(sessionId: string, name: string, args: unknown, toolCallId?: string) {
    logger.info(
      `[ElectronStreamEmitter] sendToolStart - sessionId=${sessionId}, name=${name}, callId=${toolCallId ?? ''}`
    )
    const snap = ensureActiveMainStreamSnapshot(sessionId)
    const callId =
      typeof toolCallId === 'string' && toolCallId.length > 0
        ? toolCallId
        : `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    if (name === 'emoji_send') {
      const emojiId = extractEmojiIdFromToolArgs(args)
      if (emojiId) {
        snap.pendingEmojis.push({ emojiId })
      }
    } else {
      const start = Date.now()
      snap.activeToolStartTime = start
      snap.activeTool = { name, args, callId }
      appendTimelineToolStart(snap.timeline, {
        callId,
        name,
        args,
        startTime: start
      })
    }
    this.safeSend('agent:tool-start', { sessionId, name, args, toolCallId: callId })
  }

  sendToolResult(sessionId: string, name: string, result: unknown, toolCallId?: string) {
    logger.info(
      `[ElectronStreamEmitter] sendToolResult - sessionId=${sessionId}, name=${name}, callId=${toolCallId ?? ''}`
    )
    const snap = ensureActiveMainStreamSnapshot(sessionId)
    if (name !== 'emoji_send') {
      const start = snap.activeToolStartTime || Date.now()
      const durationMs = Date.now() - start
      snap.completedTools.push({ name, startTime: start, durationMs, callId: toolCallId })
      snap.activeTool = null
      completeTimelineTool(snap.timeline, { callId: toolCallId, name, result })
    }
    this.safeSend('agent:tool-result', { sessionId, name, result, toolCallId })
  }

  sendFinish(sessionId: string, payload: StreamFinishPayload) {
    logger.info(
      `[ElectronStreamEmitter] sendFinish - sessionId=${sessionId}, payload=${JSON.stringify(payload)}`
    )
    clearMainStreamSnapshot(sessionId)
    this.safeSend('agent:stream-finish', { sessionId, ...payload })
  }
}
