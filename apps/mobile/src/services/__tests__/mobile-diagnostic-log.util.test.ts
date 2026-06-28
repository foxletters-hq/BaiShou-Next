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
})
