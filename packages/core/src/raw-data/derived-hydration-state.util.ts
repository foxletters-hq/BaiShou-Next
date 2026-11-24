import { logger, type ISqlExecutor } from '@baishou/shared'

export const DERIVED_HYDRATION_STATE_KEY = '__derived_hydration_state_v1'

export interface DerivedHydrationState {
  /** 已完成旧版向量 → Memory JSONL 一次性回填的仓库 ID 集合 */
  backfilledVaultIds: string[]
  /** 已完成跨仓库遗留手动记忆一次性复制 */
  legacyManualCopyDone: boolean
}

function normalizeState(raw: unknown): DerivedHydrationState {
  if (!raw || typeof raw !== 'object') {
    return { backfilledVaultIds: [], legacyManualCopyDone: false }
  }
  const obj = raw as Record<string, unknown>
  const ids = Array.isArray(obj.backfilledVaultIds)
    ? [
        ...new Set(
          obj.backfilledVaultIds
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean)
        )
      ]
    : []
  return {
    backfilledVaultIds: ids,
    legacyManualCopyDone: obj.legacyManualCopyDone === true
  }
}

export function hasVaultBackfillCompleted(state: DerivedHydrationState, vaultId: string): boolean {
  const id = vaultId.trim()
  return Boolean(id) && state.backfilledVaultIds.includes(id)
}

export function markVaultBackfillCompleted(
  state: DerivedHydrationState,
  vaultId: string
): DerivedHydrationState {
  const id = vaultId.trim()
  if (!id || state.backfilledVaultIds.includes(id)) return state
  return {
    ...state,
    backfilledVaultIds: [...state.backfilledVaultIds, id]
  }
}

export async function loadDerivedHydrationState(
  sqlExecutor: ISqlExecutor
): Promise<DerivedHydrationState> {
  try {
    const res = await sqlExecutor.execute({
      sql: `SELECT value FROM system_settings WHERE key = ? LIMIT 1`,
      args: [DERIVED_HYDRATION_STATE_KEY]
    })
    const rawValue = res.rows[0]?.value
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      return { backfilledVaultIds: [], legacyManualCopyDone: false }
    }
    return normalizeState(JSON.parse(rawValue))
  } catch (e: unknown) {
    logger.warn(
      '[DerivedHydrationState] load failed, treating as empty:',
      e instanceof Error ? e.message : String(e)
    )
    return { backfilledVaultIds: [], legacyManualCopyDone: false }
  }
}

export async function saveDerivedHydrationState(
  sqlExecutor: ISqlExecutor,
  state: DerivedHydrationState
): Promise<void> {
  try {
    const normalized = normalizeState(state)
    await sqlExecutor.execute({
      sql: `
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      args: [DERIVED_HYDRATION_STATE_KEY, JSON.stringify(normalized), Date.now()]
    })
  } catch (e: unknown) {
    logger.warn(
      '[DerivedHydrationState] save failed (non-blocking):',
      e instanceof Error ? e.message : String(e)
    )
  }
}
