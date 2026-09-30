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

/** 启动时若尚未拿到存储根，连接会失败；进入知识库时再连一次。 */
export async function ensureMobileKnowledgeConnected(): Promise<void> {
  if (expoKnowledgeConnectionManager.isConnected()) return
  const pathService = agentDbRuntimeRef.current?.pathService
  if (!pathService) {
    throw new Error('knowledge db not connected')
  }
  const { createMobileFileSystem } = await import('./create-mobile-file-system')
  const fileSystem = createMobileFileSystem()
  const root = await pathService.getRootDirectory()
  await fileSystem.mkdir(root, { recursive: true })
  await expoKnowledgeConnectionManager.connect(root)
  if (!expoKnowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
}

export async function ensureMobileKnowledgeRepo(): Promise<KnowledgeRepository> {
  await ensureMobileKnowledgeConnected()
  return requireMobileKnowledgeRepo()
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
