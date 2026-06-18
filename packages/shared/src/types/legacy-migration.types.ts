export type LegacyMigrationSectionId =
  | 'avatar'
  | 'identityCards'
  | 'config'
  | 'diaries'
  | 'assistants'
  | 'chatMessages'
  | 'workspaces'

export interface LegacyMigrationSectionPreview {
  id: LegacyMigrationSectionId
  label: string
  detected: boolean
  count: number
  sizeBytes: number
  sizeLabel: string
  samples: string[]
  warnings: string[]
  importable: boolean
}

export interface LegacyMigrationScanResult {
  sourceDir: string
  candidatePaths: string[]
  sections: LegacyMigrationSectionPreview[]
}

export interface LegacyMigrationImportSelection {
  avatar?: boolean
  identityCards?: boolean
  config?: boolean
  diaries?: boolean
  assistants?: boolean
  chatMessages?: boolean
  workspaces?: boolean
}

export interface LegacyMigrationImportSectionResult {
  id: LegacyMigrationSectionId
  success: number
  skipped: number
  failed: number
  errors: string[]
}

export interface LegacyMigrationImportResult {
  sections: LegacyMigrationImportSectionResult[]
  cancelled?: boolean
}

export interface LegacyMigrationProgressEvent {
  phase: 'scan' | 'import'
  section?: LegacyMigrationSectionId
  message: string
  current?: number
  total?: number
}

export interface LegacySelectiveMigrationManifest {
  assistants: Record<string, string>
  sessions: Record<string, string>
  lastSourceDir?: string
}

export const LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY = 'legacy_selective_migration_manifest'
