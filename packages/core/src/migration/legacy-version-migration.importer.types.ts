import type { IFileSystem } from '../fs/file-system.types'
import type { DiaryService } from '../diary/diary.service'
import type { AssistantManagerService } from '../assistant/assistant-manager.service'
import type { SessionManagerService } from '../session/session-manager.service'
import type { VaultService } from '../vault/vault.service'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import type { RawSqlExecutor } from './legacy-migration.shared'
import type { LegacyAvatarImporter } from './legacy-avatar-migration.shared'

export const JOURNAL_DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/i
export const LEGACY_IMPORT_SESSION_PAGE_SIZE = 50
export const LEGACY_IMPORT_MESSAGE_PAGE_SIZE = 40
export const LEGACY_IMPORT_PART_PAGE_SIZE = 40

export function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

export interface LegacyVersionMigrationImporterDeps {
  fileSystem: IFileSystem
  sourceRoot: string
  targetRoot: string
  flutterPrefsConfig: Record<string, unknown> | null
  /** Flutter SP 原始键值（含 user_personas） */
  flutterRawSp: Record<string, unknown> | null
  flutterDocumentsAvatarsDir: string | null
  sqliteClient: unknown
  executeRawSql: RawSqlExecutor
  settingsRepo: SettingsRepository
  profileRepo: UserProfileRepository
  diaryService: DiaryService
  assistantManager: AssistantManagerService
  sessionManager: SessionManagerService
  vaultService: VaultService
  importAvatar: LegacyAvatarImporter
  saveUserAvatarPath: (relativePath: string) => Promise<void>
  existingAssistantNames: () => Promise<Set<string>>
  existingSessionIds: () => Promise<Set<string>>
  existingPersonaIds: () => Promise<Set<string>>
  storedAssistantIdMap?: Record<string, string>
  upsertSessionAggregate: (aggregate: unknown) => Promise<void>
  runInVaultContext: <T>(vaultName: string, fn: () => Promise<T>) => Promise<T>
  resolveTargetVaultName: (legacyVaultName: string) => Promise<string>
  onVaultNameMapped?: (legacyName: string, targetName: string) => Promise<void>
  flushSettingsToDisk?: () => Promise<void>
  onProgress?: (message: string) => void
  /** 读取映射后的目标工作区日记原文（用于去重比对） */
  readTargetJournalRaw?: (dateStr: string, targetVaultName: string) => Promise<string | null>
  /** 当前工作区是否已有该伙伴 JSON（用于跳过重复导入） */
  assistantRecordExists?: (assistantId: string) => Promise<boolean>
  /** 移动端迁移：按映射后的目标工作区解析 Journals 根目录（仅写文件、不建影子索引） */
  getJournalsBaseDirectory?: (targetVaultName: string) => Promise<string>
  /** 移动端迁移：按映射后的目标工作区解析 Sessions 根目录，用于流式写大会话 JSON */
  getSessionsBaseDirectory?: (targetVaultName: string) => Promise<string>
  /** 将旧版 db 路径转为当前平台可 ATTACH 的路径 */
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
}

export interface LegacyAgentSessionSource {
  rawAttachPath: string
  attachPath: string
}

export interface LegacyAgentRows {
  assistants: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  messages: Record<string, unknown>[]
  parts: Record<string, unknown>[]
  errors: string[]
  sessionSources?: Map<string, LegacyAgentSessionSource>
}
