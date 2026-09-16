import { describe, expect, it } from 'vitest'
import {
  flushReasonFromStreamChunk,
  shouldFlushStreamingAssistant,
  streamingAssistantSnapshotKey
} from '../agent/streaming-assistant-flush.util'

describe('shouldFlushStreamingAssistant', () => {
  it('should flush the first token immediately when nothing has been written yet', () => {
    expect(
      shouldFlushStreamingAssistant({
        reason: 'token',
        hasNewContentSinceFlush: true,
        lastFlushAt: null,
        now: 1000
      })
    ).toBe(true)
  })

  it('should wait for the idle window before flushing later tokens', () => {
    expect(
      shouldFlushStreamingAssistant({
        reason: 'token',
        hasNewContentSinceFlush: true,
        lastFlushAt: 1000,
        now: 2000,
        idleMs: 1500
      })
    ).toBe(false)
    expect(
      shouldFlushStreamingAssistant({
        reason: 'token',
        hasNewContentSinceFlush: true,
        lastFlushAt: 1000,
        now: 2600,
        idleMs: 1500
      })
    ).toBe(true)
  })

  it('should flush on tool or step when content changed', () => {
    expect(
      shouldFlushStreamingAssistant({
        reason: 'tool',
        hasNewContentSinceFlush: true,
        lastFlushAt: 1000,
        now: 1100
      })
    ).toBe(true)
    expect(
      shouldFlushStreamingAssistant({
        reason: 'step',
        hasNewContentSinceFlush: true,
        lastFlushAt: 1000,
        now: 1100
      })
    ).toBe(true)
  })

  it('should not flush when the snapshot has not changed', () => {
    expect(
      shouldFlushStreamingAssistant({
        reason: 'tool',
        hasNewContentSinceFlush: false,
        lastFlushAt: 1000,
        now: 5000
      })
    ).toBe(false)
  })
})

describe('flushReasonFromStreamChunk', () => {
  it('should map stream chunk types to flush reasons', () => {
    expect(flushReasonFromStreamChunk('text-delta')).toBe('token')
    expect(flushReasonFromStreamChunk('reasoning-delta')).toBe('token')
    expect(flushReasonFromStreamChunk('tool-call')).toBe('tool')
    expect(flushReasonFromStreamChunk('tool-result')).toBe('tool')
    expect(flushReasonFromStreamChunk('step-finish')).toBe('step')
    expect(flushReasonFromStreamChunk('finish')).toBeNull()
  })
})

describe('streamingAssistantSnapshotKey', () => {
  it('should change when text or tool count grows', () => {
    const first = streamingAssistantSnapshotKey({
      text: '你好',
      reasoning: '',
      toolCount: 0,
      fileChangeCount: 0,
      gateCount: 0
    })
    const next = streamingAssistantSnapshotKey({
      text: '你好世界',
      reasoning: '',
      toolCount: 1,
      fileChangeCount: 0,
      gateCount: 0
    })
    expect(first).not.toBe(next)
  })
})
