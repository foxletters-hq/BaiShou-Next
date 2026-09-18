import {
  generateRemappedId,
  normalizeLegacyPartData,
  normalizeLegacyPartType
} from './legacy-version-migration.util'

export function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value)
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export function toUnixSec(value: unknown): number {
  return Math.floor(toDate(value).getTime() / 1000)
}

export function buildLegacyMessageAggregate(
  messageRow: Record<string, unknown>,
  partRows: Record<string, unknown>[],
  newSessionId: string,
  index: number
) {
  const oldMessageId = String(messageRow.id ?? generateRemappedId('legacy_msg'))
  const newMessageId = oldMessageId
  return {
    id: newMessageId,
    sessionId: newSessionId,
    role: String(messageRow.role ?? 'user'),
    isSummary: Number(messageRow.is_summary) === 1,
    orderIndex: messageRow.order_index != null ? Number(messageRow.order_index) : index,
    inputTokens: messageRow.input_tokens != null ? Number(messageRow.input_tokens) : undefined,
    outputTokens: messageRow.output_tokens != null ? Number(messageRow.output_tokens) : undefined,
    costMicros: messageRow.cost_micros != null ? Number(messageRow.cost_micros) : undefined,
    providerId: messageRow.provider_id != null ? String(messageRow.provider_id) : undefined,
    modelId: messageRow.model_id != null ? String(messageRow.model_id) : undefined,
    createdAt: toDate(messageRow.created_at),
    parts: partRows.map((partRow) => {
      const partType = normalizeLegacyPartType(partRow.type)
      return {
        id: String(partRow.id ?? generateRemappedId('legacy_part')),
        messageId: newMessageId,
        sessionId: newSessionId,
        type: partType,
        data: normalizeLegacyPartData(partRow.data, partType),
        createdAt: toDate(partRow.created_at)
      }
    })
  }
}

export function buildLegacySessionAggregate(
  sessionRow: Record<string, unknown>,
  newSessionId: string,
  mappedAssistantId: string,
  targetVaultName: string
) {
  return {
    id: newSessionId,
    title: sessionRow.title != null ? String(sessionRow.title) : null,
    vaultName: targetVaultName,
    assistantId: mappedAssistantId,
    isPinned: Number(sessionRow.is_pinned) === 1,
    systemPrompt: sessionRow.system_prompt != null ? String(sessionRow.system_prompt) : undefined,
    providerId: sessionRow.provider_id != null ? String(sessionRow.provider_id) : '',
    modelId: sessionRow.model_id != null ? String(sessionRow.model_id) : '',
    totalInputTokens:
      sessionRow.total_input_tokens != null ? Number(sessionRow.total_input_tokens) : 0,
    totalOutputTokens:
      sessionRow.total_output_tokens != null ? Number(sessionRow.total_output_tokens) : 0,
    totalCacheReadInputTokens:
      sessionRow.total_cache_read_input_tokens != null
        ? Number(sessionRow.total_cache_read_input_tokens)
        : 0,
    totalCacheWriteInputTokens:
      sessionRow.total_cache_write_input_tokens != null
        ? Number(sessionRow.total_cache_write_input_tokens)
        : 0,
    totalCostMicros:
      sessionRow.total_cost_micros != null ? Number(sessionRow.total_cost_micros) : 0,
    createdAt: toDate(sessionRow.created_at),
    updatedAt: toDate(sessionRow.updated_at)
  }
}
