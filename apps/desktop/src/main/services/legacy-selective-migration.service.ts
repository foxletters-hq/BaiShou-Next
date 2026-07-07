import i18n from 'i18next'
import { createNodeFileSystem, LegacyImportService } from '@baishou/core-desktop'
import { isLegacyAppRoot } from '@baishou/core/shared'
import type {
  LegacyMigrationImportResult,
  LegacyMigrationImportSelection,
  LegacyMigrationProgressEvent,
  LegacyMigrationScanResult,
  LegacySelectiveMigrationManifest
} from '@baishou/shared'
import { LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY } from '@baishou/shared'
import { SettingsRepository, UserProfileRepository } from '@baishou/database-desktop'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { DesktopStoragePathService } from './path.service'
import { getAppDb } from '../db'
import { resolveLegacyPreferencesForMigration } from './flutter-legacy-paths.service'
import { validateImportSelection } from './legacy-selective-migration.helpers'
import { scanLegacyMigration } from './legacy-selective-migration.scan'
import {
  afterImportComplete,
  importAvatar,
  importAssistants,
  importChatMessages,
  importConfig,
  importDiaries,
  importIdentityCards
} from './legacy-selective-migration.import-sections'
import { importWorkspaces } from './legacy-selective-migration.workspace-import'

type ProgressFn = (event: LegacyMigrationProgressEvent) => void

export class LegacySelectiveMigrationService {
  private readonly fileSystem = createNodeFileSystem()
  private cancelled = false

  cancel(): void {
    this.cancelled = true
  }

  private wasCancelled(): boolean {
    return this.cancelled
  }

  private importCtx() {
    return {
      fileSystem: this.fileSystem,
      wasCancelled: () => this.wasCancelled()
    }
  }

  async scan(sourceDir?: string, onProgress?: ProgressFn): Promise<LegacyMigrationScanResult> {
    return scanLegacyMigration(
      { fileSystem: this.fileSystem, cancelled: false },
      sourceDir,
      onProgress
    )
  }

  async importSelected(
    sourceDir: string,
    selectionInput: LegacyMigrationImportSelection,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportResult> {
    this.cancelled = false
    const selection = validateImportSelection(selectionInput)
    const trimmedSource = sourceDir?.trim()
    if (!trimmedSource) {
      throw new Error(
        i18n.t(
          'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L565',
          '请指定旧版数据目录'
        )
      )
    }
    if (!(await isLegacyAppRoot(this.fileSystem, trimmedSource))) {
      throw new Error(
        i18n.t(
          'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L568',
          '无效的旧版数据目录'
        )
      )
    }

    const results: import('@baishou/shared').LegacyMigrationImportSectionResult[] = []
    const pathService = new DesktopStoragePathService()
    const attManager = new DesktopAttachmentManagerService(pathService)
    const db = getAppDb()
    const settingsRepo = new SettingsRepository(db)
    const profileRepo = new UserProfileRepository(db)
    const legacyImporter = new LegacyImportService(settingsRepo, profileRepo)
    const prefs = await resolveLegacyPreferencesForMigration(trimmedSource)
    const sp = prefs.sp

    const manifest = (await settingsRepo.get<LegacySelectiveMigrationManifest>(
      LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY
    )) ?? { assistants: {}, sessions: {}, diaries: {}, personas: {} }
    manifest.diaries = manifest.diaries ?? {}
    manifest.personas = manifest.personas ?? {}
    manifest.lastSourceDir = trimmedSource

    let assistantIdMap = new Map<string, string>(Object.entries(manifest.assistants))
    const ctx = this.importCtx()

    if (selection.avatar) {
      results.push(await importAvatar(ctx, trimmedSource, sp, profileRepo, attManager, onProgress))
    }
    if (selection.identityCards) {
      results.push(
        await importIdentityCards(ctx, sp, prefs.config, profileRepo, manifest, onProgress)
      )
    }
    if (selection.config) {
      results.push(await importConfig(ctx, legacyImporter, prefs.config, onProgress))
    }
    if (selection.workspaces) {
      results.push(await importWorkspaces(ctx, trimmedSource, onProgress))
    }
    if (selection.diaries) {
      results.push(await importDiaries(ctx, trimmedSource, manifest, onProgress))
    }
    if (selection.assistants) {
      const assistantResult = await importAssistants(
        ctx,
        trimmedSource,
        attManager,
        assistantIdMap,
        onProgress
      )
      assistantIdMap = assistantResult.idMap
      manifest.assistants = Object.fromEntries(assistantIdMap)
      results.push(assistantResult.result)
    }
    if (selection.chatMessages) {
      const chatResult = await importChatMessages(
        ctx,
        trimmedSource,
        assistantIdMap,
        manifest,
        onProgress
      )
      manifest.sessions = { ...manifest.sessions, ...chatResult.sessionMap }
      results.push(chatResult.result)
    }

    await settingsRepo.set(LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY, manifest)

    const cancelled = this.wasCancelled()
    if (!cancelled) {
      onProgress?.({
        phase: 'import',
        message: i18n.t(
          'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L633',
          '正在刷新索引与界面…'
        )
      })
      await afterImportComplete()
      onProgress?.({
        phase: 'import',
        message: i18n.t(
          'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L635',
          '导入完成'
        )
      })
    } else {
      onProgress?.({
        phase: 'import',
        message: i18n.t(
          'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L637',
          '导入已取消（已完成部分可能已写入）'
        )
      })
    }

    return { sections: results, cancelled }
  }
}
