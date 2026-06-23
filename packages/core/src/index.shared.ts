/**
 * @baishou/core — 桌面与移动端共用的业务逻辑（无 Git、Electron 旧版导入等桌面专用模块）
 */

export * from './fs'
export * from './storage/storage-root-migration'
export * from './migration/legacy-migration.shared'
export * from './migration/flutter-shared-prefs.util'
export * from './migration/legacy-avatar-migration.shared'
export * from './migration/legacy-archive-migration.shared'
export * from './migration/legacy-runtime-artifacts.shared'
export * from './migration/migration-target-path.service'
export * from './migration/legacy-selective-migration.shared'
export * from './import/legacy-config-restore.shared'
export * from './migration/legacy-version-migration.util'
export * from './migration/legacy-journal-migration.util'
export * from './migration/legacy-version-migration.scan'
export * from './migration/legacy-version-migration.importer'

export * from './diary/diary.service'
export * from './diary/file-sync.service'
export * from './diary/vault-index.service'
export * from './diary/diary-export.service'
export * from './services/agent.service'
export * from './vault/vault.types'
export * from './vault/storage-path.types'
export * from './vault/vault.errors'
export * from './vault/vault-name.util'
export * from './vault/vault-disk.util'
export * from './vault/vault-external-paths.service'
export * from './vault/vault.service'
export * from './attachments/attachment-manager.types'
export * from './diary/diary.types'
export * from './journal/journal-files.util'
export * from './summary/summary-files.util'
export * from './journal/journal-index-probe.util'
export { parseJournalMarkdown } from './diary/journal-markdown.parser'

export * from './session/session-file.service'
export * from './session/session-sync.service'
export * from './session/session-manager.service'

export * from './assistant/assistant-file.service'
export * from './assistant/assistant-manager.service'
export * from './assistant/ensure-default-latte-assistant'

export * from './settings/settings-file.service'
export * from './settings/settings-manager.service'

export * from './session/compression-prompt'
export * from './session/compression.service'
export * from './session/system-prompt-builder'
export * from './session/model-pricing.service'
export * from './session/memory-deduplication.service'

export * from './summary/summary-prompt-templates'
export * from './summary/summary-generator.service'
export * from './summary/summary-ai.constants'
export * from './vault/summary-file.service'
export * from './summary/summary-sync.service'
export * from './summary/summary-manager.service'
export * from './summary/missing-summary-detector.service'
export {
  buildSharedContextText,
  handleBuildSharedContext,
  type SharedContextDiaryRow
} from './summary/summary-context'

export * from './archive/archive.interface'
export * from './archive/archive-manifest.util'
export * from './archive/archive-import-preferences.util'
export * from './archive/archive-import-detection.shared'

export * from './network/lan-sync.interface'
export * from './network/cloud-sync.interface'

export * from './shadow-index/shadow-index-sync.service'
export * from './sync/incremental-sync-external-mounts'
export * from './events'
