import type { IFileSystem } from '@baishou/core-mobile'

export const SYNC_SESSION_FILENAME = 'sync-session.json'

export type IncrementalSyncSessionMode = 'sync'

export type IncrementalSyncSessionState = {
  startedAt: number
  updatedAt: number
  total: number
  completed: number
  lastFile?: string
  mode: IncrementalSyncSessionMode
}

export async function readIncrementalSyncSession(
  fileSystem: IFileSystem,
  metaDir: string
): Promise<IncrementalSyncSessionState | null> {
  const path = `${metaDir}/${SYNC_SESSION_FILENAME}`
  if (!(await fileSystem.exists(path))) return null
  try {
    const raw = await fileSystem.readFile(path)
    return JSON.parse(raw) as IncrementalSyncSessionState
  } catch {
    return null
  }
}

export async function writeIncrementalSyncSession(
  fileSystem: IFileSystem,
  metaDir: string,
  state: IncrementalSyncSessionState
): Promise<void> {
  const path = `${metaDir}/${SYNC_SESSION_FILENAME}`
  await fileSystem.writeFile(path, JSON.stringify(state, null, 2))
}

export async function clearIncrementalSyncSession(
  fileSystem: IFileSystem,
  metaDir: string
): Promise<void> {
  const path = `${metaDir}/${SYNC_SESSION_FILENAME}`
  if (await fileSystem.exists(path)) {
    await fileSystem.unlink(path).catch(() => {})
  }
}

/** 规划阶段无待办时，是否可安全清除过期的中断 session 记录 */
export function shouldClearInterruptedSyncSessionOnPlan(
  session: IncrementalSyncSessionState,
  decisionCount: number,
  pendingChangeCount: number
): boolean {
  if (pendingChangeCount > 0) return false
  if (session.completed >= session.total) return true
  if (session.total > 0) {
    const drift = Math.abs(session.total - decisionCount)
    const tolerance = Math.max(8, Math.round(decisionCount * 0.15))
    if (drift > tolerance) return true
  }
  return session.completed >= session.total - 1
}

export function isInterruptedSyncSessionResumable(
  session: IncrementalSyncSessionState | null
): session is IncrementalSyncSessionState {
  return Boolean(
    session &&
      session.total > 0 &&
      session.completed > 0 &&
      session.completed < session.total
  )
}
