import type {
  IFileSystem,
  SettingsManagerService,
  SessionManagerService
} from '@baishou/core-mobile'
import type { IStoragePathService } from '@baishou/core-mobile'
import { reconcileUserAvatarProfileAfterStorageChange } from '../lib/user-avatar-reconcile.util'
import { MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES } from './mobile-file-read-limits'
import { classifyIncrementalSyncPaths } from './mobile-incremental-sync-path-classify.util'
import type { MobileIncrementalSyncOutcome } from './mobile-incremental-engine.types'
import type { MobileDataBootstrapper } from './mobile-bootstrapper.service'

export interface MobileIncrementalAfterSyncDeps {
  settingsManager: SettingsManagerService
  pathService: IStoragePathService
  fileSystem: IFileSystem
  bootstrapper?: MobileDataBootstrapper
  sessionManager?: SessionManagerService
  reportPostSync: (statusText: string, current: number, total: number) => void
  refreshCheckpointForPaths: (relPaths: string[]) => Promise<void>
  resolveActiveUserProfileSyncRelPath: () => Promise<string | null>
  onAfterSyncComplete?: () => void
}

/**
 * 传输结束后的本地收尾：只处理本次触及的文件类型。
 * 禁止无条件全量 resync（会写盘改 hash，导致下次又提示上传）。
 */
export async function runMobileIncrementalAfterSync(
  outcome: MobileIncrementalSyncOutcome,
  deps: MobileIncrementalAfterSyncDeps
): Promise<void> {
  try {
    const cls = classifyIncrementalSyncPaths([
      ...outcome.downloadedPaths,
      ...outcome.deletedLocalPaths
    ])
    console.warn('[IncrementalSync][PostSync] start', {
      uploaded: outcome.uploaded,
      downloaded: outcome.downloaded,
      deletedLocal: outcome.deletedLocal,
      classify: {
        journals: cls.journals,
        sessions: cls.sessions,
        summaries: cls.summaries,
        settings: cls.settings,
        assistants: cls.assistants,
        sessionRefCount: cls.sessionRefs.length
      }
    })
    const needsLocalIndex =
      outcome.downloaded > 0 ||
      outcome.deletedLocal > 0 ||
      cls.journals ||
      cls.sessions ||
      cls.summaries ||
      cls.settings ||
      cls.assistants

    let step = 0
    const needsSessionHydrate = cls.sessions || cls.sessionRefs.length > 0
    const totalSteps = (needsSessionHydrate ? 1 : 0) + (needsLocalIndex ? 3 : 0) + 1
    const checkpointRefreshPaths: string[] = []

    if (needsSessionHydrate && deps.sessionManager) {
      deps.reportPostSync('data_sync.progress_hydrate_sessions', ++step, totalSteps)
      try {
        const { listDiskVaultFolderNames } = await import('@baishou/core-mobile')
        const syncRoot = await deps.pathService.getRootDirectory()
        const diskVaultNames = await listDiskVaultFolderNames(deps.fileSystem, syncRoot)
        let activeVaultName: string | null = null
        const pathWithContext = deps.pathService as IStoragePathService & {
          getActiveVaultNameForContext?: () => Promise<string>
        }
        if (typeof pathWithContext.getActiveVaultNameForContext === 'function') {
          activeVaultName = await pathWithContext.getActiveVaultNameForContext()
        }
        // 缺 id 补齐（廉价）
        await deps.sessionManager.hydrateSessionsFromDiskIfNeeded({
          activeVaultName,
          diskVaultNames,
          maxSessionJsonReadBytes: MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
        })
        // 本次下载的会话定点灌库（不 fullScan、不 flushPending 写盘）
        if (cls.sessionRefs.length > 0) {
          await deps.sessionManager.importSessionsFromDisk(cls.sessionRefs, {
            maxSessionJsonReadBytes: MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
          })
        }
      } catch (e: unknown) {
        console.warn('[IncrementalSync][SessionHydrate] after-sync failed:', e)
      }
    }

    if (!needsLocalIndex) {
      deps.reportPostSync('data_sync.progress_finalizing', totalSteps, totalSteps)
      console.warn('[IncrementalSync][PostSync] skip-index', { reason: 'upload-or-noop' })
      return
    }

    const registeredDeps = deps.bootstrapper?.getRegisteredDeps()
    if (deps.bootstrapper && registeredDeps) {
      deps.reportPostSync('data_sync.progress_index_local', ++step, totalSteps)
      await deps.bootstrapper.runSelectiveResync(registeredDeps, {
        journals: cls.journals || outcome.deletedLocalPaths.some((p) => /Journals|Diary/i.test(p)),
        summaries: cls.summaries,
        assistants: cls.assistants,
        settings: cls.settings,
        skipEnsures: true,
        onStep: (key) => deps.reportPostSync(key, step, totalSteps)
      })
    }

    deps.reportPostSync('data_sync.progress_reconcile_avatar', ++step, totalSteps)
    if (cls.settings || outcome.downloadedPaths.some((p) => /avatar/i.test(p))) {
      const avatarResult = await reconcileUserAvatarProfileAfterStorageChange(
        deps.settingsManager,
        deps.pathService,
        deps.fileSystem
      )
      if (avatarResult.changed) {
        const profileRel = await deps.resolveActiveUserProfileSyncRelPath()
        if (profileRel) checkpointRefreshPaths.push(profileRel)
        console.warn('[IncrementalSync][PostSync] avatar-profile-rewritten', {
          profileRel
        })
      }
    }

    if (cls.journals) {
      deps.reportPostSync('data_sync.progress_schedule_embed', ++step, totalSteps)
      const { schedulePostSyncDiaryBatchEmbed } =
        await import('./mobile-post-sync-diary-embed.service')
      schedulePostSyncDiaryBatchEmbed()
    }

    if (checkpointRefreshPaths.length > 0) {
      try {
        await deps.refreshCheckpointForPaths(checkpointRefreshPaths)
      } catch (e: unknown) {
        console.warn('[IncrementalSync][PostSync] refreshCheckpoint failed:', e)
      }
    }

    deps.reportPostSync('data_sync.progress_finalizing', totalSteps, totalSteps)
    console.warn('[IncrementalSync][PostSync] done', {
      checkpointRefreshCount: checkpointRefreshPaths.length
    })
  } catch (e: unknown) {
    console.warn('[MobileIncrementalSync] afterSyncComplete failed:', e)
  } finally {
    deps.onAfterSyncComplete?.()
  }
}
