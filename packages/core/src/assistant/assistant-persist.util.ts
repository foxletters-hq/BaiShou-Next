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

export function pickDefinedAssistantUpdate<T extends Record<string, unknown>>(
  input: T
): Partial<T> {
  return pickDefined(input)
}

export function toPersistedAssistantAvatarPath(
  avatarPath: string | null | undefined
): string | null | undefined {
  if (avatarPath == null) return avatarPath
  return normalizePersistedAvatarPath(avatarPath) ?? normalizeAssistantAvatarPath(avatarPath)
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

export interface DiskAssistantRecord {
  id?: string
  name?: string
  avatarPath?: string | null
  assistantKind?: string
  sortOrder?: number
  createdAt?: string | number | Date | null
  updatedAt?: string | number | Date | null
  [key: string]: unknown
}

/** 将磁盘 JSON 记录规范化为 SQLite / 写盘可识别的字段 */
function sortRecordKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecordKeysDeep)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortRecordKeysDeep(obj[key])
    }
    return sorted
  }
  return value
}

export function normalizeDiskAssistantRecord(
  raw: Record<string, unknown> | null | undefined
): DiskAssistantRecord | null {
  if (!raw) return null
  const data: DiskAssistantRecord = { ...raw }

  if (data.assistant_kind != null && data.assistantKind == null) {
    data.assistantKind = String(data.assistant_kind)
  }
  delete data.assistant_kind

  if (data.sort_order != null && data.sortOrder == null) {
    const parsed = Number(data.sort_order)
    data.sortOrder = Number.isFinite(parsed) ? parsed : 0
  }
  delete data.sort_order

  if (data.assistantKind != null) {
    data.assistantKind = normalizeAssistantKind(String(data.assistantKind)) as AssistantKind
  }

  if (data.sortOrder != null) {
    const parsed = Number(data.sortOrder)
    data.sortOrder = Number.isFinite(parsed) ? parsed : 0
  }

  if (data.createdAt != null) {
    const ms = toAssistantUpdatedAtMs(data.createdAt)
    data.createdAt = ms != null ? new Date(ms).toISOString() : data.createdAt
  }
  if (data.updatedAt != null) {
    const ms = toAssistantUpdatedAtMs(data.updatedAt)
    data.updatedAt = ms != null ? new Date(ms).toISOString() : data.updatedAt
  }

  return data
}

/** 用于判断伙伴 JSON 语义是否变化，避免无意义写盘触发增量同步 */
export function stableAssistantDiskJson(data: Record<string, unknown>): string {
  const normalized = normalizeDiskAssistantRecord(data)
  return JSON.stringify(sortRecordKeysDeep(normalized ?? data), null, 2)
}
