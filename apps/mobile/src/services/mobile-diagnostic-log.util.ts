export type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface DiagnosticLogEntry {
  ts: number
  level: DiagnosticLogLevel
  message: string
}

interface SequencedDiagnosticLogEntry extends DiagnosticLogEntry {
  seq: number
}

export interface DiagnosticLogFlushSnapshot {
  lines: string[]
  endSeq: number
}

export function formatDiagnosticLogEntry(entry: DiagnosticLogEntry): string {
  const iso = new Date(entry.ts).toISOString()
  return `${iso} [${entry.level.toUpperCase()}] ${entry.message}`
}

export function trimDiagnosticEntries(
  items: DiagnosticLogEntry[],
  maxEntries: number
): DiagnosticLogEntry[] {
  if (items.length <= maxEntries) return items
  return items.slice(items.length - maxEntries)
}

export function trimDiagnosticText(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text
  return text.slice(text.length - maxBytes)
}

const MAX_SERIALIZED_ARG_CHARS = 4096
const MAX_INLINE_BODY_CHARS = 512
const NUMERIC_VECTOR_MIN_LEN = 32
const SENSITIVE_BODY_KEYS = new Set(['responseBody', 'requestBodyValues', 'rawBody'])

function isNumericVectorArray(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < NUMERIC_VECTOR_MIN_LEN) return false
  const sampleCount = Math.min(value.length, 8)
  for (let i = 0; i < sampleCount; i++) {
    if (typeof value[i] !== 'number') return false
  }
  return true
}

function redactDiagnosticValue(key: string, value: unknown): unknown {
  if (isNumericVectorArray(value)) {
    return `[number[${value.length}]]`
  }
  if (value instanceof Float32Array || value instanceof Float64Array) {
    return `[FloatArray[${value.length}]]`
  }
  if (typeof value === 'string') {
    if (
      SENSITIVE_BODY_KEYS.has(key) &&
      (value.includes('"embedding":[') || value.length > MAX_INLINE_BODY_CHARS)
    ) {
      return value.includes('"embedding":[')
        ? `[redacted embedding payload, len=${value.length}]`
        : `${value.slice(0, MAX_INLINE_BODY_CHARS)}...[truncated, len=${value.length}]`
    }
    if (value.length > MAX_SERIALIZED_ARG_CHARS) {
      return `${value.slice(0, MAX_SERIALIZED_ARG_CHARS)}...[truncated, len=${value.length}]`
    }
  }
  if (value instanceof Error && key !== '') {
    return { name: value.name, message: value.message }
  }
  return value
}

export function serializeDiagnosticArg(value: unknown): string {
  if (value instanceof Error) {
    const raw = value.stack
      ? `${value.name}: ${value.message}\n${value.stack}`
      : `${value.name}: ${value.message}`
    return raw.length > MAX_SERIALIZED_ARG_CHARS
      ? `${raw.slice(0, MAX_SERIALIZED_ARG_CHARS)}...[truncated, len=${raw.length}]`
      : raw
  }
  if (typeof value === 'string') {
    return value.length > MAX_SERIALIZED_ARG_CHARS
      ? `${value.slice(0, MAX_SERIALIZED_ARG_CHARS)}...[truncated, len=${value.length}]`
      : value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value)
  }
  if (isNumericVectorArray(value)) {
    return `[number[${value.length}]]`
  }
  try {
    const serialized = JSON.stringify(value, redactDiagnosticValue)
    if (typeof serialized !== 'string') return String(value)
    return serialized.length > MAX_SERIALIZED_ARG_CHARS
      ? `${serialized.slice(0, MAX_SERIALIZED_ARG_CHARS)}...[truncated, len=${serialized.length}]`
      : serialized
  } catch {
    return String(value)
  }
}

export function serializeDiagnosticArgs(args: unknown[]): string {
  return args.map(serializeDiagnosticArg).join(' ')
}

export class DiagnosticLogBuffer {
  private entries: SequencedDiagnosticLogEntry[] = []
  private nextSeq = 1
  private flushedSeq = 0

  constructor(private readonly maxEntries: number) {}

  append(level: DiagnosticLogLevel, message: string, extra?: unknown): void {
    const trimmedMessage = message.replace(/\s+$/, '')
    if (!trimmedMessage) return

    const suffix =
      extra === undefined
        ? ''
        : extra instanceof Error && extra.stack
          ? `\n${extra.stack}`
          : `\n${serializeDiagnosticArg(extra)}`

    const entry: SequencedDiagnosticLogEntry = {
      seq: this.nextSeq++,
      ts: Date.now(),
      level,
      message: `${trimmedMessage}${suffix}`
    }
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(this.entries.length - this.maxEntries)
    }
  }

  breadcrumb(message: string): void {
    this.append('info', `[breadcrumb] ${message}`)
  }

  /**
   * 抓取当前尚未落盘的日志快照及末尾序号。
   * 落盘完成后调用 markFlushedUpTo(endSeq)，确保异步写盘期间新追加的日志不会被误标为已落盘。
   */
  getUnflushedSnapshot(): DiagnosticLogFlushSnapshot {
    const pending = this.entries.filter((entry) => entry.seq > this.flushedSeq)
    if (pending.length === 0) {
      return { lines: [], endSeq: this.flushedSeq }
    }
    return {
      lines: pending.map(formatDiagnosticLogEntry),
      endSeq: pending[pending.length - 1]!.seq
    }
  }

  getUnflushedFormattedLines(): string[] {
    return this.getUnflushedSnapshot().lines
  }

  peekAllFormattedLines(): string[] {
    return this.entries.map(formatDiagnosticLogEntry)
  }

  markFlushedUpTo(endSeq: number): void {
    if (endSeq > this.flushedSeq) {
      this.flushedSeq = endSeq
    }
  }

  markFlushed(): void {
    const last = this.entries[this.entries.length - 1]
    if (last && last.seq > this.flushedSeq) {
      this.flushedSeq = last.seq
    }
  }

  /** @deprecated 仅在写入成功后丢弃已持久化条目 */
  drainFormattedLines(): string[] {
    const snapshot = this.getUnflushedSnapshot()
    this.markFlushedUpTo(snapshot.endSeq)
    return snapshot.lines
  }

  peekFormattedLines(): string[] {
    return this.peekAllFormattedLines()
  }

  clear(): void {
    this.entries = []
    this.flushedSeq = this.nextSeq - 1
  }

  size(): number {
    return this.entries.length
  }

  unflushedSize(): number {
    let count = 0
    for (const entry of this.entries) {
      if (entry.seq > this.flushedSeq) count += 1
    }
    return count
  }
}
