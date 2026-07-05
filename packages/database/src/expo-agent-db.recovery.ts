import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'

export type ExpoAgentDbIntegrityResult = {
  ok: boolean
  detail?: string
}

type ExpoSqliteProbe = ExpoSqliteDatabase & {
  getAllAsync?: (sql: string) => Promise<unknown[]>
}

function extractQuickCheckValue(rows: unknown[] | undefined): string | undefined {
  if (!rows?.length) return undefined
  const first = rows[0]
  if (typeof first === 'string') return first
  if (typeof first !== 'object' || first == null) return undefined

  const record = first as Record<string, unknown>
  const value = record.quick_check ?? record['quick_check'] ?? Object.values(record)[0]
  if (value == null) return undefined
  return String(value)
}

/** 启动或自愈后校验 Agent 主库是否可读 */
export async function verifyExpoAgentDatabaseIntegrity(
  expoDb: ExpoSqliteDatabase
): Promise<ExpoAgentDbIntegrityResult> {
  const db = expoDb as ExpoSqliteProbe

  try {
    if (typeof db.getAllAsync === 'function') {
      const rows = await db.getAllAsync('PRAGMA quick_check')
      const value = extractQuickCheckValue(rows)
      if (value === 'ok') {
        return { ok: true }
      }
      if (value != null && value !== 'ok') {
        return { ok: false, detail: value }
      }
    } else {
      const rows = (await expoDb.execAsync('PRAGMA quick_check')) as unknown[]
      const value = extractQuickCheckValue(rows)
      if (value === 'ok') {
        return { ok: true }
      }
      if (value != null && value !== 'ok') {
        return { ok: false, detail: value }
      }
    }

    // 部分 Android expo-sqlite 对 PRAGMA quick_check 不返回行；用轻量读探针代替误报
    if (typeof db.getAllAsync === 'function') {
      await db.getAllAsync('SELECT 1 AS probe')
      return { ok: true }
    }

    await expoDb.execAsync('SELECT 1')
    return { ok: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, detail: message }
  }
}
