import { normalizeReasoningEffortSetting, type ReasoningEffortSetting } from './reasoning-effort'

/** 需要思考强度的模型用途；嵌入 / TTS 不在此列 */
export const MODEL_REASONING_SLOTS = ['dialogue', 'graph', 'naming', 'summary', 'vision'] as const

export type ModelReasoningSlot = (typeof MODEL_REASONING_SLOTS)[number]

export type ReasoningEffortBySlot = Partial<Record<ModelReasoningSlot, ReasoningEffortSetting>>

export function isModelReasoningSlot(value: unknown): value is ModelReasoningSlot {
  return typeof value === 'string' && (MODEL_REASONING_SLOTS as readonly string[]).includes(value)
}

/** 只保留已知用途；非法值与 auto 都视为未写（读取时回落 Default） */
export function normalizeReasoningEffortBySlot(value: unknown): ReasoningEffortBySlot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const next: ReasoningEffortBySlot = {}
  for (const slot of MODEL_REASONING_SLOTS) {
    if (!Object.prototype.hasOwnProperty.call(raw, slot)) continue
    const normalized = normalizeReasoningEffortSetting(raw[slot])
    if (normalized !== 'auto') next[slot] = normalized
  }
  return next
}

export function resolveReasoningEffortForSlot(
  bySlot: ReasoningEffortBySlot | null | undefined,
  slot: ModelReasoningSlot
): ReasoningEffortSetting {
  return normalizeReasoningEffortSetting(bySlot?.[slot])
}

export function setReasoningEffortForSlot(
  bySlot: ReasoningEffortBySlot | null | undefined,
  slot: ModelReasoningSlot,
  value: ReasoningEffortSetting
): ReasoningEffortBySlot {
  const next = { ...(bySlot ?? {}) }
  const normalized = normalizeReasoningEffortSetting(value)
  if (normalized === 'auto') delete next[slot]
  else next[slot] = normalized
  return next
}

/** 对话页：按模型记忆优先，否则用对话用途分档；都缺则 Default */
export function resolveDialogueEffortPreference(
  byModel: unknown,
  dialogueSlot: unknown
): ReasoningEffortSetting {
  const remembered = normalizeReasoningEffortSetting(byModel)
  if (remembered !== 'auto') return remembered
  return normalizeReasoningEffortSetting(dialogueSlot)
}
