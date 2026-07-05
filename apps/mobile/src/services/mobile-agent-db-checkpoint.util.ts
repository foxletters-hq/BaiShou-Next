/** 与桌面 ZipExporter 对齐：优先 TRUNCATE，必要时降级 PASSIVE */
export const AGENT_DB_EXPORT_CHECKPOINT_SQL = [
  'PRAGMA wal_checkpoint(TRUNCATE)',
  'PRAGMA wal_checkpoint(PASSIVE)'
] as const

export async function checkpointAgentDatabaseForExport(
  execSql: (sql: string) => Promise<unknown>,
  options?: { retries?: number; retryDelayMs?: number }
): Promise<void> {
  const retries = options?.retries ?? 2
  const retryDelayMs = options?.retryDelayMs ?? 80
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const sql of AGENT_DB_EXPORT_CHECKPOINT_SQL) {
      try {
        await execSql(sql)
        return
      } catch (error) {
        lastError = error
      }
    }
    if (attempt < retries) {
      await delay(retryDelayMs * (attempt + 1))
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }
  throw new Error(String(lastError ?? 'WAL checkpoint failed'))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
