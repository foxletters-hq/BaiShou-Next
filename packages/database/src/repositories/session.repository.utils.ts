export function generateSessionUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export {
  detectSqliteDriver,
  usesSyncTransaction,
  withExpoAgentDatabaseLock
} from '../expo-agent-db.lock'

import { usesSyncTransaction } from '../expo-agent-db.lock'

/** @deprecated 使用 usesSyncTransaction */
function isBetterSqliteDb(db: unknown): boolean {
  return usesSyncTransaction(db)
}

export { isBetterSqliteDb }
