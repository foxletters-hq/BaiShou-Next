import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { logger } from '@baishou/shared'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { FLUTTER_LEGACY_MIGRATED_SOURCE_KEY } from '@/src/constants/storage'
import {
  deleteMigratedLegacySourceRoot,
  resolveFlutterLegacyMigrationTargetRoot
} from '../../services/mobile-legacy-migration.service'
import {
  quiesceStorageForFileCopy,
  rebootstrapAfterStorageRootChange,
  resumeStorageAfterFileCopy
} from '../../services/mobile-vault-runtime.service'
import { attachMobileRagVaultScope } from '../../services/mobile-rag-vault-scope'
import { createMobileRagService } from '../../services/mobile-rag.service'
import { setMobileDiaryEmbeddingDeps } from '../../services/mobile-diary-embedding.service'
import {
  isExternalStorageRequiredError,
  hasStoragePermission
} from '../../services/storage-permission.service'
import type { MobileBaishouInitContext } from './init-context'
import type { MobileBaishouCoreState } from './bootstrap-mobile-baishou-core'

export async function finalizeStorageRefHandlers(
  ctx: MobileBaishouInitContext,
  state: MobileBaishouCoreState
): Promise<void> {
  const { refs } = ctx
  const isMounted = ctx.isMounted
  const s = state as Record<string, any>
  const mobileMcpService = s.mobileMcpService
  const pathService = s.pathService
  const vaultService = s.vaultService
  const fileSystem = s.fileSystem
  const settingsManager = s.settingsManager
  const bootstrapDeps = s.bootstrapDeps
  const watcherDeps = s.watcherDeps
  const registry = s.registry
  const hsRepo = s.hsRepo
  const hybridSearchService = s.hybridSearchService
  const sqlExecutor = s.sqlExecutor
  const ragServiceRef = s.ragServiceRef
  const runStorageBootstrap = s.runStorageBootstrap as (options?: {
    forceDeferResync?: boolean
    resyncReason?: string
  }) => Promise<import('../../services/mobile-vault-runtime.service').VaultBoundDiaryStack>
  refs.retryStorageSetupRef.current = async (options?: { forceDeferResync?: boolean }) => {
    try {
      if (Platform.OS === 'android') {
        const applied = await pathService.applyExternalRootWhenPermitted()
        if (!applied && !(await hasStoragePermission())) {
          return false
        }
      }

      const priorStack = refs.diaryStackRef.current
      const bootstrapOptions = options?.forceDeferResync
        ? { forceDeferResync: true as const, resyncReason: 'legacy-migration-complete' }
        : undefined
      const stack = !priorStack
        ? await runStorageBootstrap(bootstrapOptions)
        : await rebootstrapAfterStorageRootChange({
            pathService,
            vaultService,
            fileSystem,
            diaryStack: priorStack,
            bootstrapDeps,
            watcherDeps
          })
      refs.diaryStackRef.current = stack

      const ragDeps = attachMobileRagVaultScope(
        {
          settingsManager,
          diaryService: stack.diaryService,
          hsRepo,
          hybridSearchService,
          registry,
          rawSqlClient: sqlExecutor
        },
        pathService,
        vaultService
      )
      ragServiceRef.current = createMobileRagService(ragDeps)
      setMobileDiaryEmbeddingDeps(ragDeps)
      if (isMounted()) {
        ctx.setValue((prev) => ({
          ...prev,
          storageReady: true,
          vaultRevision: prev.vaultRevision + 1,
          services: prev.services
            ? {
                ...prev.services,
                ragService: ragServiceRef.current
              }
            : prev.services
        }))
      }
      return true
    } catch (e) {
      if (!isExternalStorageRequiredError(e)) {
        logger.error('[BaishouProvider] retryStorageSetup failed:', e as Error)
      }
      return false
    }
  }

  refs.deleteMigratedLegacySourceRef.current = async () => {
    const runtime = refs.migrationRuntimeRef.current
    if (!runtime) return false

    const sourceRoot = await AsyncStorage.getItem(FLUTTER_LEGACY_MIGRATED_SOURCE_KEY)
    if (!sourceRoot) return false

    const targetRoot = resolveFlutterLegacyMigrationTargetRoot()
    try {
      await deleteMigratedLegacySourceRoot({
        fileSystem: runtime.fileSystem,
        sourceRoot,
        targetRoot,
        installInstanceId: runtime.installInstanceId
      })
      await AsyncStorage.removeItem(FLUTTER_LEGACY_MIGRATED_SOURCE_KEY)
      if (isMounted()) {
        ctx.setValue((prev) => ({
          ...prev,
          legacyMigrationSourcePendingDeletion: null
        }))
      }
      return true
    } catch (error) {
      logger.warn('[BaishouProvider] Failed to delete migrated legacy source:', error as Error)
      return false
    }
  }

  refs.runWithStorageQuiescedRef.current = async <T>(fn: () => Promise<T>): Promise<T> => {
    let mcpWasRunning = false
    const stack = refs.diaryStackRef.current
    let result: T | undefined
    let fnError: unknown
    let resumeError: unknown
    if (isMounted()) {
      ctx.setValue((prev) => ({ ...prev, vaultSwitching: true }))
    }
    try {
      const runtime = agentDbRuntimeRef.current
      await quiesceStorageForFileCopy({
        currentStack: stack ?? undefined,
        settingsManager: runtime?.settingsManager ?? settingsManager,
        sessionManager: runtime?.sessionManager
      })
      const activeMcp = refs.vaultBootstrapCtxRef.current?.mobileMcpService ?? mobileMcpService
      if (activeMcp?.isServerRunning()) {
        mcpWasRunning = true
        await activeMcp.stop()
      }
      result = await fn()
    } catch (e) {
      fnError = e
    } finally {
      try {
        const vaultCtx = refs.vaultBootstrapCtxRef.current
        const runtime = agentDbRuntimeRef.current
        if (refs.archiveFullRestoreDoneRef.current) {
          const stack = refs.diaryStackRef.current
          if (stack && vaultCtx && runtime) {
            const resumedRagDeps = attachMobileRagVaultScope(
              {
                settingsManager: runtime.settingsManager,
                diaryService: stack.diaryService,
                hsRepo: runtime.hsRepo,
                hybridSearchService: runtime.hybridSearchService,
                registry: vaultCtx.registry,
                rawSqlClient: runtime.sqlExecutor
              },
              vaultCtx.pathService,
              vaultCtx.vaultService
            )
            setMobileDiaryEmbeddingDeps(resumedRagDeps)
            vaultCtx.ragServiceRef.current = createMobileRagService(resumedRagDeps)
          }
        } else {
          const priorStack = refs.diaryStackRef.current
          if (priorStack && vaultCtx && runtime) {
            refs.diaryStackRef.current = null
            try {
              const resumedStack = await resumeStorageAfterFileCopy({
                pathService: vaultCtx.pathService,
                vaultService: vaultCtx.vaultService,
                fileSystem: vaultCtx.fileSystem,
                bootstrapDeps: vaultCtx.bootstrapDeps,
                watcherDeps: vaultCtx.watcherDeps
              })
              refs.diaryStackRef.current = resumedStack
              const resumedRagDeps = attachMobileRagVaultScope(
                {
                  settingsManager: runtime.settingsManager,
                  diaryService: resumedStack.diaryService,
                  hsRepo: runtime.hsRepo,
                  hybridSearchService: runtime.hybridSearchService,
                  registry: vaultCtx.registry,
                  rawSqlClient: runtime.sqlExecutor
                },
                vaultCtx.pathService,
                vaultCtx.vaultService
              )
              setMobileDiaryEmbeddingDeps(resumedRagDeps)
              vaultCtx.ragServiceRef.current = createMobileRagService(resumedRagDeps)
            } catch (caughtResumeError) {
              logger.error(
                '[BaishouProvider] resumeStorageAfterFileCopy failed, retrying setup:',
                caughtResumeError as Error
              )
              const recovered = await refs.retryStorageSetupRef.current()
              if (!recovered) {
                refs.diaryStackRef.current = priorStack
                resumeError = caughtResumeError
              }
            }
          } else {
            await refs.retryStorageSetupRef.current()
          }
        }
        if (mcpWasRunning) {
          const activeMcp = refs.vaultBootstrapCtxRef.current?.mobileMcpService ?? mobileMcpService
          await activeMcp?.start()
        }
        if (isMounted()) {
          const ragRef = refs.vaultBootstrapCtxRef.current?.ragServiceRef ?? ragServiceRef
          const stack = refs.diaryStackRef.current
          ctx.setValue((prev) => ({
            ...prev,
            vaultSwitching: false,
            vaultRevision: prev.vaultRevision + 1,
            services: prev.services
              ? {
                  ...prev.services,
                  ragService: ragRef.current,
                  ...(stack ? { diaryService: stack.diaryService } : {})
                }
              : prev.services
          }))
        }
      } catch (e) {
        logger.error('[BaishouProvider] runWithStorageQuiesced resume failed:', e as Error)
        if (isMounted()) {
          ctx.setValue((prev) => ({ ...prev, vaultSwitching: false }))
        }
      }
    }
    if (resumeError) throw resumeError
    if (fnError) throw fnError
    return result as T
  }
}
