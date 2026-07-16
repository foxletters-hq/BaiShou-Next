import { describe, expect, it } from 'vitest'
import {
  DiagnosticLogBuffer,
  buildDiagnosticExportFileName,
  formatDiagnosticLogEntry,
  serializeDiagnosticArg,
  serializeDiagnosticArgs,
  trimDiagnosticEntries,
  trimDiagnosticText
} from '../desktop-diagnostic-log.util'

describe('desktop-diagnostic-log.util', () => {
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

  it('trims persisted text by length', () => {
    expect(trimDiagnosticText('abcdef', 4)).toBe('cdef')
  })

  it('serializes errors and objects safely', () => {
    expect(serializeDiagnosticArg(new Error('boom'))).toContain('Error: boom')
    expect(serializeDiagnosticArgs(['a', 1])).toBe('a 1')
  })

  it('keeps unflushed entries until markFlushed', () => {
    const buffer = new DiagnosticLogBuffer(10)
    buffer.append('info', 'one')
    expect(buffer.getUnflushedFormattedLines()).toHaveLength(1)
    buffer.markFlushed()
    expect(buffer.getUnflushedFormattedLines()).toHaveLength(0)
    expect(buffer.peekAllFormattedLines()).toHaveLength(1)
  })
})

describe('buildDiagnosticExportFileName', () => {
  it('builds a stable desktop export filename', () => {
    expect(buildDiagnosticExportFileName(new Date('2026-07-16T12:00:00.000Z'))).toBe(
      'baishou_diagnostic_2026-07-16T12-00-00-000Z.txt'
    )
  })
})
