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

export function serializeDiagnosticArg(value: unknown): string {
  if (value instanceof Error) {
    return value.stack
      ? `${value.name}: ${value.message}\n${value.stack}`
      : `${value.name}: ${value.message}`
  }
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return String(value)
  }
  try {
    return JSON.stringify(value)
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
