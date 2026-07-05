/** 版本迁移全局板块 ID */
export type LegacyVersionMigrationGlobalSectionId = 'avatar' | 'personas' | 'config'

export const WORKSPACE_SECTION_PREFIX = 'workspace:' as const

/** 版本迁移板块 ID（全局或 workspace:工作区名） */
export type LegacyVersionMigrationSectionId =
  | LegacyVersionMigrationGlobalSectionId
  | `${typeof WORKSPACE_SECTION_PREFIX}${string}`

export type LegacyVersionMigrationImportStatus =
  | 'idle'
  | 'importing'
  | 'success'
  | 'failed'
  | 'unavailable'

export interface LegacyVersionMigrationPreviewItem {
  label: string
  detail?: string
}

export interface LegacyVersionMigrationSectionPreview {
  sectionId: LegacyVersionMigrationSectionId
  titleKey: string
  bytes: number
  count: number
  available: boolean
  warnings: string[]
  previewItems?: LegacyVersionMigrationPreviewItem[]
}

export interface LegacyVersionMigrationWorkspacePreview {
  legacyVaultName: string
  sectionId: LegacyVersionMigrationSectionId
  diaryCount: number
  diaryBytes: number
  archiveCount: number
  archiveBytes: number
  assistantCount: number
  sessionCount: number
  agentBytes: number
  available: boolean
  warnings: string[]
  previewItems?: LegacyVersionMigrationPreviewItem[]
}

export interface LegacyVersionMigrationScanResult {
  sourceRoot: string
  sourceDisplayPath: string
  globalSections: LegacyVersionMigrationSectionPreview[]
  workspaces: LegacyVersionMigrationWorkspacePreview[]
}

export interface LegacyVersionMigrationImportResult {
  sectionId: LegacyVersionMigrationSectionId
  imported: number
  skipped: number
  failed: number
  warnings: string[]
  errors?: string[]
  failureSamples?: string[]
}

export interface LegacyVersionMigrationBatchImportResult extends LegacyVersionMigrationImportResult {
  sectionResults: LegacyVersionMigrationImportResult[]
}

export interface LegacyVersionMigrationState {
  assistantIdMap: Record<string, string>
  vaultNameMap: Record<string, string>
  importedSections: LegacyVersionMigrationSectionId[]
  updatedAt: string
}

export type LegacyVersionMigrationSourceKind = 'manual' | 'flutter' | 'migrated'

export interface LegacyVersionMigrationScanPayload {
  scanResult: LegacyVersionMigrationScanResult | null
  sourceKind: LegacyVersionMigrationSourceKind | null
  customSourceRoot: string | null
  importedSections: LegacyVersionMigrationSectionId[]
  /** 旧版目录与当前工作区根目录相同，在原位做结构转换 */
  inPlace: boolean
}

export function isWorkspaceMigrationSectionId(
  sectionId: string
): sectionId is `${typeof WORKSPACE_SECTION_PREFIX}${string}` {
  return sectionId.startsWith(WORKSPACE_SECTION_PREFIX)
}

export function formatMigrationMegabytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 0.01) return '< 0.01 MB'
  return `${mb.toFixed(2)} MB`
}
