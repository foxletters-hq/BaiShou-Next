import { describe, expect, it } from 'vitest'
import {
  buildLegacyMessageAggregate,
  toDate,
  toUnixSec
} from '../legacy-version-migration.importer.chats.build'

describe('legacy chat timestamp helpers', () => {
  it('should treat second-scale numbers as unix seconds when converting to Date', () => {
    const date = toDate(1_700_000_000)
    expect(date.getTime()).toBe(1_700_000_000_000)
  })

  it('should keep millisecond numbers when converting to Date', () => {
    const date = toDate(1_700_000_000_123)
    expect(date.getTime()).toBe(1_700_000_000_123)
  })

  it('should floor a Date to unix seconds when writing SQL', () => {
    expect(toUnixSec(new Date('2020-01-01T00:00:00.900Z'))).toBe(1_577_836_800)
  })
})

describe('buildLegacyMessageAggregate', () => {
  it('should normalize part type and keep the message id when rows are complete', () => {
    const message = buildLegacyMessageAggregate(
      {
        id: 'msg-1',
        role: 'assistant',
        is_summary: 0,
        order_index: 2,
        created_at: 1_700_000_000
      },
      [{ id: 'part-1', type: 'text', data: '你好', created_at: 1_700_000_000 }],
      'sess-1',
      9
    )
    expect(message.id).toBe('msg-1')
    expect(message.sessionId).toBe('sess-1')
    expect(message.orderIndex).toBe(2)
    expect(message.parts[0]?.type).toBe('text')
    expect(message.parts[0]?.data).toEqual({ text: '你好' })
  })
})
