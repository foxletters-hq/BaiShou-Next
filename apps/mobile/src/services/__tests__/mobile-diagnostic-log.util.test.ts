import { describe, expect, it } from 'vitest'
import {
  DiagnosticLogBuffer,
  formatDiagnosticLogEntry,
  serializeDiagnosticArg,
  serializeDiagnosticArgs,
  trimDiagnosticEntries,
  trimDiagnosticText
} from '../mobile-diagnostic-log.util'

describe('mobile-diagnostic-log.util', () => {
  it('formats entries with ISO timestamp and level', () => {
    const line = formatDiagnosticLogEntry({
      ts: Date.UTC(2026, 5, 28, 2, 30, 0),
      level: 'warn',
      message: 'hello'
    })
    expect(line).toContain('[WARN] hello')
    expect(line).toContain('2026-06-28T02:30:00.000Z')
  })

  it('trims memory entries to max size', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ts: index,
      level: 'info' as const,
      message: String(index)
    }))
    expect(trimDiagnosticEntries(items, 3).map((item) => item.message)).toEqual(['2', '3', '4'])
  })

  it('trims persisted text by byte length', () => {
    expect(trimDiagnosticText('abcdef', 4)).toBe('cdef')
  })

  it('serializes errors and objects safely', () => {
    expect(serializeDiagnosticArg(new Error('boom'))).toContain('Error: boom')
    expect(serializeDiagnosticArgs(['a', 1])).toBe('a 1')
  })

  it('keeps unflushed entries until markFlushed', () => {
    const logBuffer = new DiagnosticLogBuffer(10)
    logBuffer.append('info', 'first')
    logBuffer.append('error', 'second')
    expect(logBuffer.getUnflushedFormattedLines()).toHaveLength(2)
    expect(logBuffer.peekAllFormattedLines()).toHaveLength(2)
    logBuffer.markFlushed()
    expect(logBuffer.getUnflushedFormattedLines()).toHaveLength(0)
    expect(logBuffer.peekAllFormattedLines()).toHaveLength(2)
    logBuffer.append('warn', 'third')
    expect(logBuffer.getUnflushedFormattedLines()).toHaveLength(1)
  })

  it('should preserve entries appended during an in-flight flush when marking flushed by sequence', () => {
    const logBuffer = new DiagnosticLogBuffer(10)
    logBuffer.append('info', 'first')
    const snapshot = logBuffer.getUnflushedSnapshot()
    expect(snapshot.lines).toHaveLength(1)

    // 模拟异步写盘进行中又产生两条新日志
    logBuffer.append('warn', 'during-flush')
    logBuffer.append('error', 'after-flush-start')

    logBuffer.markFlushedUpTo(snapshot.endSeq)

    const remaining = logBuffer.getUnflushedSnapshot()
    expect(remaining.lines).toHaveLength(2)
    expect(remaining.lines[0]).toContain('during-flush')
    expect(remaining.lines[1]).toContain('after-flush-start')
    expect(logBuffer.unflushedSize()).toBe(2)
  })

  it('should redact raw float embedding arrays and oversized embedding responseBody payloads', () => {
    const rawVector = Array.from({ length: 4096 }, (_, i) => i * 0.0001)
    expect(serializeDiagnosticArg(rawVector)).toBe('[number[4096]]')

    const apiErrorLike = {
      name: 'AI_TypeValidationError',
      message: 'Type validation failed',
      responseBody: JSON.stringify({
        data: [{ embedding: rawVector, index: 0, object: 'embedding' }],
        model: 'Qwen/Qwen3-Embedding-8B'
      }),
      isRetryable: false
    }
    const serialized = serializeDiagnosticArg({ error: apiErrorLike })
    expect(serialized).toContain('[redacted embedding payload')
    expect(serialized).not.toContain('0.0001,0.0002')
  })
})
