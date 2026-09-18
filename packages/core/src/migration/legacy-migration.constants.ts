export {
  LEGACY_UPGRADE_RAG_NOTICE_MAX,
  LEGACY_UPGRADE_RAG_PENDING_KEY,
  LEGACY_UPGRADE_RAG_NOTICE_COUNT_KEY
} from '@baishou/shared'

export const LEGACY_MIGRATION_STATUS_FILE = '.baishou_next_migration.json'
export const LEGACY_REGISTRY_RELATIVE = '.baishou/vault_registry.json'
export const NEXT_REGISTRY_FILENAME = 'vault_registry.json'

/** 归档根目录下不属于工作区的文件夹（与移动端 ARCHIVE_SKIP_TOP_LEVEL 对齐） */
export const LEGACY_ARCHIVE_SKIP_TOP_LEVEL = new Set([
  'config',
  'assistant_avatars',
  'database',
  'manifest.json',
  'user-data',
  'node_modules',
  'snapshots',
  'temp',
  '.snapshots'
])

export const LEGACY_AGENT_MERGE_TABLES = [
  'agent_assistants',
  'agent_sessions',
  'agent_messages',
  'agent_parts',
  'compression_snapshots'
] as const

export const LEGACY_BAISHOUL_MERGE_TABLES = ['diaries', 'summaries'] as const

/** 低于此体积的 agent.sqlite 视为空壳工作区 */
export const MIN_AGENT_SQLITE_BYTES_FOR_IMPORT = 49_152

export type LegacyMigrationSource = 'flutter_desktop' | 'flutter_mobile' | 'flutter_zip'

export interface LegacyMigrationStatus {
  version: 1
  completedAt: string
  source: LegacyMigrationSource
  migrationCompleted: true
  installInstanceId: string
  ragSkipped: true
  ragReembedRequired: true
  vaultsMigrated: string[]
}

export type RawSqlExecutor = (
  client: unknown,
  statement: string,
  args?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>
