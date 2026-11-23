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

export function buildDiagnosticExportFileName(
  now = new Date(),
  prefix = 'baishou_diagnostic'
): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return `${prefix}_${stamp}.txt`
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
