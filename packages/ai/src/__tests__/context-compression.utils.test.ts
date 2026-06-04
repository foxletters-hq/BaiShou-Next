import { describe, it, expect } from 'vitest'
import {
  shouldCompressContext,
  resolveSnapshotCutoffIndex,
  getMessagesAfterSnapshot,
  splitMessagesForCompression,
  estimateMessagesTokens,
  trimLeadingOrphanMessagesAfterSnapshot,
  resolveCompressionBatch,
  buildCompressionOldSummaryPrefix,
  hasEnoughMessagesForRecompress,
  formatMessagesAsCompressionTranscript,
  hasUserContentInCompressionBatch,
  getModelContextWindow,
  usableContextTokens,
  resolveCompressionTrigger,
  computeTailStartMessageId,
  DEFAULT_MODEL_CONTEXT_WINDOW
} from '../agent/context-compression.utils'
import type { MessageWithParts } from '../agent/message.adapter'

function msg(id: string, role: string, orderIndex: number, text: string): MessageWithParts {
  return {
    id,
    sessionId: 's1',
    role: role as MessageWithParts['role'],
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts: [{ id: `p-${id}`, messageId: id, sessionId: 's1', type: 'text', data: { text } }]
  }
}

describe('context-compression.utils', () => {
  it('shouldCompress respects threshold 0 as disabled', () => {
    expect(shouldCompressContext(100_000, 0)).toBe(false)
    expect(shouldCompressContext(100_000, 8000)).toBe(true)
    expect(shouldCompressContext(5000, 8000)).toBe(false)
  })

  it('resolveSnapshotCutoffIndex finds by message id and legacy orderIndex', () => {
    const messages = [msg('a', 'user', 1, 'hi'), msg('b', 'assistant', 2, 'hello')]
    expect(
      resolveSnapshotCutoffIndex(messages, {
        id: 1,
        sessionId: 's1',
        summaryText: 'x',
        coveredUpToMessageId: 'a',
        messageCount: 1,
        tokenCount: null,
        createdAt: new Date()
      })
    ).toBe(0)
    expect(
      resolveSnapshotCutoffIndex(messages, {
        id: 1,
        sessionId: 's1',
        summaryText: 'x',
        coveredUpToMessageId: '2',
        messageCount: 1,
        tokenCount: null,
        createdAt: new Date()
      })
    ).toBe(1)
  })

  it('splitMessagesForCompression keeps recent user turns', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c'),
      msg('4', 'assistant', 4, 'd'),
      msg('5', 'user', 5, 'e'),
      msg('6', 'assistant', 6, 'f')
    ]
    const { toCompress, retain } = splitMessagesForCompression(messages, 2)
    expect(toCompress.map((m) => m.id)).toEqual(['1', '2'])
    expect(retain.map((m) => m.id)).toEqual(['3', '4', '5', '6'])
  })

  it('estimateMessagesTokens scales with content length', () => {
    const short = [msg('1', 'user', 1, 'hi')]
    const long = [msg('2', 'user', 2, 'x'.repeat(3000))]
    expect(estimateMessagesTokens(long)).toBeGreaterThan(estimateMessagesTokens(short))
  })

  it('getMessagesAfterSnapshot slices after cutoff', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c')
    ]
    const after = getMessagesAfterSnapshot(messages, {
      id: 9,
      sessionId: 's1',
      summaryText: 'sum',
      coveredUpToMessageId: '1',
      messageCount: 1,
      tokenCount: null,
      createdAt: new Date()
    })
    expect(after.map((m) => m.id)).toEqual(['3'])
  })

  it('resolveCompressionBatch matches auto split for recompress (same as getMessagesForRecompress)', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c'),
      msg('4', 'assistant', 4, 'd'),
      msg('5', 'user', 5, 'e'),
      msg('6', 'assistant', 6, 'f')
    ]
    const previous = {
      id: 1,
      sessionId: 's1',
      summaryText: 'old',
      coveredUpToMessageId: '2',
      messageCount: 1,
      tokenCount: null,
      createdAt: new Date()
    }
    const latest = {
      id: 2,
      sessionId: 's1',
      summaryText: 'new',
      coveredUpToMessageId: '4',
      messageCount: 3,
      tokenCount: null,
      createdAt: new Date()
    }
    const batch = resolveCompressionBatch(messages, {
      priorSnapshot: previous,
      targetSnapshot: latest,
      keepTurns: 2
    })
    expect(batch.toCompress.map((m) => m.id)).toEqual(['3', '4'])
    expect(
      resolveCompressionBatch(messages, {
        priorSnapshot: null,
        targetSnapshot: latest,
        keepTurns: 3
      }).toCompress.map((m) => m.id)
    ).toEqual(['1', '2', '3', '4'])
    expect(buildCompressionOldSummaryPrefix(previous)).toContain('old')
    expect(buildCompressionOldSummaryPrefix(null)).toBe('')
  })

  it('resolveSnapshotCutoffIndex uses messageCount span when anchor id is missing', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c'),
      msg('4', 'assistant', 4, 'd')
    ]
    const previous = {
      id: 1,
      sessionId: 's1',
      summaryText: 'old',
      coveredUpToMessageId: '2',
      messageCount: 2,
      tokenCount: null,
      createdAt: new Date()
    }
    const latest = {
      id: 2,
      sessionId: 's1',
      summaryText: 'new',
      coveredUpToMessageId: 'missing-anchor',
      messageCount: 4,
      tokenCount: null,
      createdAt: new Date()
    }
    expect(resolveSnapshotCutoffIndex(messages, latest, previous)).toBe(3)
    expect(
      resolveCompressionBatch(messages, {
        priorSnapshot: previous,
        targetSnapshot: latest,
        keepTurns: 3
      }).toCompress.map((m) => m.id)
    ).toEqual(['3', '4'])
  })

  it('hasEnoughMessagesForRecompress accepts a single user turn with text', () => {
    expect(hasEnoughMessagesForRecompress([msg('1', 'user', 1, 'only question')])).toBe(true)
    expect(hasEnoughMessagesForRecompress([msg('2', 'assistant', 2, 'only reply')])).toBe(false)
  })

  it('getMessagesForRecompress still returns messages when keepTurns would empty split', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c'),
      msg('4', 'assistant', 4, 'd')
    ]
    const latest = {
      id: 2,
      sessionId: 's1',
      summaryText: 'new',
      coveredUpToMessageId: '4',
      messageCount: 2,
      tokenCount: null,
      createdAt: new Date()
    }
    const splitEmpty = splitMessagesForCompression(messages, 3).toCompress
    expect(splitEmpty).toHaveLength(0)
    expect(
      resolveCompressionBatch(messages, {
        priorSnapshot: null,
        targetSnapshot: latest,
        keepTurns: 3
      }).toCompress.length
    ).toBeGreaterThanOrEqual(2)
  })

  it('formatMessagesAsCompressionTranscript includes user and assistant labels', () => {
    const messages = [msg('1', 'user', 1, '查天气'), msg('2', 'assistant', 2, '晴天')]
    const transcript = formatMessagesAsCompressionTranscript(messages)
    expect(transcript).toContain('【用户】')
    expect(transcript).toContain('查天气')
    expect(transcript).toContain('【助手】')
    expect(hasUserContentInCompressionBatch(messages)).toBe(true)
  })

  it('trimLeadingOrphanMessagesAfterSnapshot drops dangling assistant prefix', () => {
    const messages = [msg('2', 'assistant', 2, 'orphan'), msg('3', 'user', 3, 'c')]
    expect(trimLeadingOrphanMessagesAfterSnapshot(messages).map((m) => m.id)).toEqual(['3'])
  })

  it('splitMessagesForCompression skips single-assistant orphan slice', () => {
    const messages = [msg('2', 'assistant', 2, 'only reply'), msg('3', 'user', 3, 'c')]
    const { toCompress } = splitMessagesForCompression(messages, 1)
    expect(toCompress).toHaveLength(0)
  })

  it('getModelContextWindow maps known models and defaults otherwise', () => {
    expect(getModelContextWindow('deepseek-chat')).toBe(64_000)
    expect(getModelContextWindow('claude-3-5-sonnet')).toBe(200_000)
    expect(getModelContextWindow('gpt-4o-mini')).toBe(128_000)
    expect(getModelContextWindow('some-unknown-model')).toBe(DEFAULT_MODEL_CONTEXT_WINDOW)
    expect(getModelContextWindow(undefined)).toBe(DEFAULT_MODEL_CONTEXT_WINDOW)
  })

  it('usableContextTokens reserves a buffer from the window', () => {
    expect(usableContextTokens(0)).toBe(0)
    // 128k → reserved 20% = 25600 → usable 102400
    expect(usableContextTokens(128_000)).toBe(102_400)
    // explicit reserved override
    expect(usableContextTokens(100_000, 10_000)).toBe(90_000)
  })

  it('resolveCompressionTrigger uses min(threshold, usable window)', () => {
    // threshold smaller than usable → threshold governs
    expect(
      resolveCompressionTrigger(61_000, {
        threshold: 60_000,
        keepTurns: 3,
        modelContextWindow: 128_000
      })
    ).toBe(true)
    expect(
      resolveCompressionTrigger(59_000, {
        threshold: 60_000,
        keepTurns: 3,
        modelContextWindow: 128_000
      })
    ).toBe(false)
    // threshold disabled → window acts as safety net
    expect(
      resolveCompressionTrigger(110_000, {
        threshold: 0,
        keepTurns: 3,
        modelContextWindow: 128_000
      })
    ).toBe(true)
    expect(
      resolveCompressionTrigger(50_000, { threshold: 0, keepTurns: 3, modelContextWindow: 128_000 })
    ).toBe(false)
    // both disabled → never (unless force)
    expect(resolveCompressionTrigger(999_999, { threshold: 0, keepTurns: 3 })).toBe(false)
    expect(resolveCompressionTrigger(0, { threshold: 0, keepTurns: 3, force: true })).toBe(true)
  })

  it('splitMessagesForCompression returns tailStartMessageId on retain slice', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c'),
      msg('4', 'assistant', 4, 'd')
    ]
    const { tailStartMessageId, retain } = splitMessagesForCompression(messages, 1)
    expect(tailStartMessageId).toBe('3')
    expect(retain.map((m) => m.id)).toEqual(['3', '4'])
  })

  it('computeTailStartMessageId returns the message after the covered anchor', () => {
    const messages = [
      msg('1', 'user', 1, 'a'),
      msg('2', 'assistant', 2, 'b'),
      msg('3', 'user', 3, 'c')
    ]
    expect(computeTailStartMessageId(messages, '2')).toBe('3')
    // anchor is last message → no tail
    expect(computeTailStartMessageId(messages, '3')).toBeNull()
    // anchor not found
    expect(computeTailStartMessageId(messages, 'x')).toBeNull()
  })
})
