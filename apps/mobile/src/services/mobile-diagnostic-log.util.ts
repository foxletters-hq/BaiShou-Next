export type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface DiagnosticLogEntry {
  ts: number
  level: DiagnosticLogLevel
  message: string
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
  private entries: DiagnosticLogEntry[] = []
  private flushedCount = 0

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

    this.entries = trimDiagnosticEntries(
      [...this.entries, { ts: Date.now(), level, message: `${trimmedMessage}${suffix}` }],
      this.maxEntries
    )
    if (this.flushedCount > this.entries.length) {
      this.flushedCount = this.entries.length
    }
  }

  breadcrumb(message: string): void {
    this.append('info', `[breadcrumb] ${message}`)
  }

  getUnflushedFormattedLines(): string[] {
    return this.entries.slice(this.flushedCount).map(formatDiagnosticLogEntry)
  }

  peekAllFormattedLines(): string[] {
    return this.entries.map(formatDiagnosticLogEntry)
  }

  markFlushed(): void {
    this.flushedCount = this.entries.length
  }

  /** @deprecated 仅在写入成功后丢弃已持久化条目 */
  drainFormattedLines(): string[] {
    const lines = this.getUnflushedFormattedLines()
    this.markFlushed()
    return lines
  }

  peekFormattedLines(): string[] {
    return this.peekAllFormattedLines()
  }

  clear(): void {
    this.entries = []
    this.flushedCount = 0
  }

  size(): number {
    return this.entries.length
  }

  unflushedSize(): number {
    return this.entries.length - this.flushedCount
  }
}
