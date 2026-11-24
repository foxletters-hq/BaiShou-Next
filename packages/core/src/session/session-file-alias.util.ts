import { logger, type ISqlExecutor } from '@baishou/shared'

export const SESSION_FILE_ALIASES_KEY = '__session_file_aliases_v1'

export function sessionFileAliasKey(vaultName: string | null | undefined, fileId: string): string {
  return `${(vaultName ?? '').trim()}::${fileId}`
}

export function extractVaultFromSessionFileAliasKey(key: string): string {
  const sep = key.indexOf('::')
  return sep === -1 ? '' : key.slice(0, sep)
}

function normalizeAliases(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || typeof value !== 'string') continue
    const k = key.trim()
    const v = value.trim()
    if (k && v) {
      normalized[k] = v
    }
  }
  return normalized
}

export function areSessionFileAliasMapsEqual(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

export async function loadSessionFileAliases(
  sqlExecutor: ISqlExecutor
): Promise<Record<string, string>> {
  try {
    const res = await sqlExecutor.execute({
      sql: `SELECT value FROM system_settings WHERE key = ? LIMIT 1`,
      args: [SESSION_FILE_ALIASES_KEY]
    })
    const rawValue = res.rows[0]?.value
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      return {}
    }
    return normalizeAliases(JSON.parse(rawValue))
  } catch (e: unknown) {
    logger.warn(
      '[SessionFileAliases] load failed, treating as empty:',
      e instanceof Error ? e.message : String(e)
    )
    return {}
  }
}

export async function saveSessionFileAliases(
  sqlExecutor: ISqlExecutor,
  aliases: Readonly<Record<string, string>>
): Promise<void> {
  try {
    const normalized = normalizeAliases(aliases)
    await sqlExecutor.execute({
      sql: `
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      args: [SESSION_FILE_ALIASES_KEY, JSON.stringify(normalized), Date.now()]
    })
  } catch (e: unknown) {
    logger.warn(
      '[SessionFileAliases] save failed (non-blocking):',
      e instanceof Error ? e.message : String(e)
    )
  }
}
