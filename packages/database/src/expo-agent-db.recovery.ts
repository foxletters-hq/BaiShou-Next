import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'

export type ExpoAgentDbIntegrityResult = {
  ok: boolean
  detail?: string
}

/** 启动或自愈后校验 Agent 主库是否可读 */
export async function verifyExpoAgentDatabaseIntegrity(
  expoDb: ExpoSqliteDatabase
): Promise<ExpoAgentDbIntegrityResult> {
  try {
    const rows = (await expoDb.execAsync('PRAGMA quick_check')) as Array<Record<string, unknown>>
    const first = rows?.[0]
    const value =
      first?.quick_check ??
      first?.['quick_check'] ??
      (typeof first === 'object' ? Object.values(first ?? {})[0] : undefined)

    if (value === 'ok' || value === 0 || value === '0') {
      return { ok: true }
    }

    return {
      ok: false,
      detail: typeof value === 'string' ? value : String(value ?? 'quick_check failed')
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, detail: message }
  }
}
