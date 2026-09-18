export interface PortableCompressionSnapshot {
  coveredUpToMessageId: string
  tailStartMessageId: string | null
  summaryText: string
  messageCount: number
  tokenCount: number | null
  createdAt: number
}

type SnapshotMessage = {
  id?: string
  parts?: Array<{ type?: string; data?: unknown }>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }
  return {}
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

export function normalizePortableCompressionSnapshot(
  raw: unknown
): PortableCompressionSnapshot | null {
  const record = asRecord(raw)
  const coveredUpToMessageId = readString(
    record,
    'coveredUpToMessageId',
    'covered_up_to_message_id'
  )
  const summaryText = readString(record, 'summaryText', 'summary_text')
  if (!coveredUpToMessageId || !summaryText.trim()) return null
  const createdAt = readNumber(record, 'createdAt', 'created_at') ?? Date.now()
  return {
    coveredUpToMessageId,
    tailStartMessageId: readString(record, 'tailStartMessageId', 'tail_start_message_id') || null,
    summaryText,
    messageCount: Math.max(0, Math.floor(readNumber(record, 'messageCount', 'message_count') ?? 0)),
    tokenCount: readNumber(record, 'tokenCount', 'token_count'),
    createdAt: createdAt < 1e12 ? createdAt * 1000 : createdAt
  }
}

export function toPortableCompressionSnapshots(raw: unknown): PortableCompressionSnapshot[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => normalizePortableCompressionSnapshot(item))
    .filter((item): item is PortableCompressionSnapshot => item != null)
}

/** 从最新 completed compaction part 合成一行可移植快照。 */
export function synthesizePortableSnapshotFromMessages(
  messages: SnapshotMessage[]
): PortableCompressionSnapshot | null {
  let latest: {
    coveredUpToMessageId: string
    summaryText: string
    tokenCount: number | null
    createdAt: number
    messageIndex: number
  } | null = null

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    if (!message) continue
    for (const part of message.parts ?? []) {
      if (String(part.type ?? '').toLowerCase() !== 'compaction') continue
      const data = asRecord(part.data)
      const status = readString(data, 'status')
      if (status && status !== 'completed') continue
      const summaryText = readString(data, 'streamTranscript', 'summaryText', 'summary_text')
      const coveredUpToMessageId =
        readString(data, 'coveredUpToMessageId', 'covered_up_to_message_id') ||
        String(message.id ?? '')
      if (!summaryText.trim() || !coveredUpToMessageId) continue
      const createdAt = readNumber(data, 'compressedAt', 'createdAt', 'created_at') ?? Date.now()
      latest = {
        coveredUpToMessageId,
        summaryText,
        tokenCount: readNumber(data, 'tokenCount', 'token_count'),
        createdAt,
        messageIndex: i
      }
    }
  }
  if (!latest) return null

  const coveredIndex = messages.findIndex((message) => message.id === latest!.coveredUpToMessageId)
  const afterCovered =
    coveredIndex >= 0 ? messages[coveredIndex + 1] : messages[latest.messageIndex + 1]
  return {
    coveredUpToMessageId: latest.coveredUpToMessageId,
    tailStartMessageId: afterCovered?.id ? String(afterCovered.id) : null,
    summaryText: latest.summaryText,
    messageCount: coveredIndex >= 0 ? coveredIndex + 1 : latest.messageIndex + 1,
    tokenCount: latest.tokenCount,
    createdAt: latest.createdAt < 1e12 ? latest.createdAt * 1000 : latest.createdAt
  }
}

export function resolveAggregateSnapshots(aggregate: {
  snapshots?: unknown
  messages?: SnapshotMessage[]
}): PortableCompressionSnapshot[] {
  const fromFile = toPortableCompressionSnapshots(aggregate.snapshots)
  if (fromFile.length > 0) return fromFile
  const synthesized = synthesizePortableSnapshotFromMessages(aggregate.messages ?? [])
  return synthesized ? [synthesized] : []
}
