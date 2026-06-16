import {
  normalizeAssistantAvatarPath,
  normalizeAssistantKind,
  normalizePersistedAvatarPath,
  type AssistantKind
} from '@baishou/shared'

function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(input) as Array<keyof T>) {
    const value = input[key]
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

export function pickDefinedAssistantUpdate<T extends Record<string, unknown>>(input: T): Partial<T> {
  return pickDefined(input)
}

export function toPersistedAssistantAvatarPath(
  avatarPath: string | null | undefined
): string | null | undefined {
  if (avatarPath == null) return avatarPath
  return (
    normalizePersistedAvatarPath(avatarPath) ?? normalizeAssistantAvatarPath(avatarPath)
  )
}

export function toAssistantUpdatedAtMs(value: unknown): number | null {
  if (value == null) return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  const ms = new Date(String(value)).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function shouldApplyDiskAssistantRecord(
  diskUpdatedAt: unknown,
  dbUpdatedAt: unknown
): boolean {
  const diskMs = toAssistantUpdatedAtMs(diskUpdatedAt)
  const dbMs = toAssistantUpdatedAtMs(dbUpdatedAt)
  if (diskMs == null) return true
  if (dbMs == null) return true
  return diskMs >= dbMs
}

/** 将磁盘 JSON 记录规范化为 SQLite / 写盘可识别的字段 */
export function normalizeDiskAssistantRecord(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!raw) return null
  const data: Record<string, unknown> = { ...raw }

  if (data.assistant_kind != null && data.assistantKind == null) {
    data.assistantKind = data.assistant_kind
  }
  delete data.assistant_kind

  if (data.sort_order != null && data.sortOrder == null) {
    data.sortOrder = data.sort_order
  }
  delete data.sort_order

  if (data.assistantKind != null) {
    data.assistantKind = normalizeAssistantKind(String(data.assistantKind)) as AssistantKind
  }

  if (data.sortOrder != null) {
    const parsed = Number(data.sortOrder)
    data.sortOrder = Number.isFinite(parsed) ? parsed : 0
  }

  return data
}
