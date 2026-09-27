import { deriveLegacyVaultId } from '@baishou/shared'
import {
  expoKnowledgeConnectionManager,
  KnowledgeRepository,
  type ExpoSqliteDatabase
} from '@baishou/database/expo'
import type { KnowledgeSqlExecutor } from '@baishou/core-mobile'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'

export function requireMobileKnowledgeRepo(): KnowledgeRepository {
  if (!expoKnowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
}

export async function resolveMobileActiveVaultId(): Promise<string> {
  const runtime = agentDbRuntimeRef.current
  if (runtime?.pathService) {
    try {
      const stored = await runtime.pathService.getLocalActiveVaultId()
      if (stored?.trim()) return stored.trim()
      const name = await runtime.pathService.getActiveVaultNameForContext()
      if (name?.trim()) return deriveLegacyVaultId(name.trim())
    } catch {
      /* fall through */
    }
  }
  return deriveLegacyVaultId('Personal')
}

export function createKnowledgeSqlExecutor(expoDb: ExpoSqliteDatabase): KnowledgeSqlExecutor {
  const db = expoDb as ExpoSqliteDatabase & {
    getAllSync?: (sql: string, params?: unknown[]) => unknown[]
  }
  return {
    all(sql, params = []) {
      if (typeof db.getAllSync !== 'function') {
        throw new Error('expo-sqlite getAllSync unavailable for knowledge search')
      }
      return db.getAllSync(sql, params) as Array<Record<string, unknown>>
    }
  }
}
