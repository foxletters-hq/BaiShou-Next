import { Platform } from 'react-native'
import { unzip } from 'react-native-zip-archive'
import { isNativeArchiveImportAvailable, nativeUnzipArchive } from 'expo-baishou-server'
import {
  importDeepSeekSessions,
  scanDeepSeekExtractedArchive,
  type DeepSeekArchiveScanResult,
  type DeepSeekImportProgress,
  type DeepSeekImportResult,
  type DeepSeekTargetAssistantInput,
  type IFileSystem
} from '@baishou/core-mobile'
import { deriveLegacyVaultId, logger, normalizePersistedAvatarPath } from '@baishou/shared'
import type { BaishouContextValue } from '../providers/baishou-provider/types'
import { emitSyncMutation } from '../cache/mobile-cache-coordinator'
import { markAssistantsNeedRefresh } from '../lib/assistant-ui-refresh-signal'
import { stripFileScheme } from './android-external-fs'
import { stageZipForUnzip } from './archive-import.helpers'
import { getAppCacheDirectory } from './mobile-app-paths'
import { joinStoragePath } from './mobile-storage-path.util'

export interface ExtractedDeepSeekArchiveHandle {
  scanResult: DeepSeekArchiveScanResult
  extractDir: string
  cleanup: () => Promise<void>
}

export async function extractAndScanMobileDeepSeekZip(
  fileSystem: IFileSystem,
  zipUri: string
): Promise<ExtractedDeepSeekArchiveHandle> {
  const cacheDir = stripFileScheme(getAppCacheDirectory())
  const extractDir = joinStoragePath(
    cacheDir,
    `baishou_deepseek_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  )
  await fileSystem.mkdir(extractDir, { recursive: true })

  const cleanup = async () => {
    await fileSystem.rm(extractDir, { recursive: true, force: true }).catch(() => {})
  }

  try {
    const { nativeZipPath, cleanupStagedZip } = await stageZipForUnzip(
      {
        fileSystem,
        // stageZipForUnzip 仅使用 fileSystem，其余字段不会被读取
        pathService: undefined as never,
        vaultService: undefined as never
      },
      zipUri
    )

    try {
      const useNativeUnzip = Platform.OS === 'android' && isNativeArchiveImportAvailable()
      if (useNativeUnzip) {
        await nativeUnzipArchive(nativeZipPath, extractDir)
      } else {
        await unzip(nativeZipPath, extractDir)
      }
    } finally {
      await cleanupStagedZip?.()
    }

    const scanResult = await scanDeepSeekExtractedArchive(fileSystem, extractDir)
    return { scanResult, extractDir, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}

export async function executeMobileDeepSeekImport(
  services: NonNullable<BaishouContextValue['services']>,
  options: {
    scanResult: DeepSeekArchiveScanResult
    selectedSessionIds: ReadonlyArray<string>
    target: DeepSeekTargetAssistantInput
    /** 新建伙伴时用户从相册挑选的待导入头像 URI（与正常新建伙伴一致） */
    pendingAvatarImportUri?: string | null
    onProgress?: (progress: DeepSeekImportProgress) => void
  }
): Promise<DeepSeekImportResult> {
  const activeVault = services.vaultService.getActiveVault()
  const vaultName = activeVault?.name || (await services.pathService.getActiveVaultNameForContext())
  const vaultId = activeVault?.id || deriveLegacyVaultId(vaultName)

  let attachmentsBaseDir: string | null = null
  try {
    attachmentsBaseDir = await services.pathService.getAttachmentsBaseDirectory()
  } catch (error) {
    logger.warn('[MobileDeepSeekImport] resolve attachments directory failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  let resolvedTarget: DeepSeekTargetAssistantInput = options.target
  if (resolvedTarget.mode === 'new') {
    let finalAvatarPath = normalizePersistedAvatarPath(resolvedTarget.avatarPath) || undefined
    if (options.pendingAvatarImportUri && services.attachmentManager?.importAvatar) {
      finalAvatarPath = await services.attachmentManager.importAvatar(
        options.pendingAvatarImportUri,
        'agent'
      )
    }
    resolvedTarget = {
      ...resolvedTarget,
      ...(finalAvatarPath ? { avatarPath: finalAvatarPath } : {})
    }
  }

  const result = await importDeepSeekSessions(
    {
      fileSystem: services.fileSystem,
      sessionRepo: services.sessionRepo,
      sessionManager: services.sessionManager,
      assistantManager: services.assistantManager
    },
    {
      scanResult: options.scanResult,
      selectedSessionIds: options.selectedSessionIds,
      target: resolvedTarget,
      vaultId,
      vaultName,
      attachmentsBaseDir,
      onProgress: options.onProgress
    }
  )

  if (result.createdNewAssistant) {
    markAssistantsNeedRefresh()
  }

  if (result.importedSessions > 0 || result.createdNewAssistant) {
    emitSyncMutation('resync-complete', 'deepseek-import')
  }

  return result
}
