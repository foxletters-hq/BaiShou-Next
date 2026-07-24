import { Platform } from 'react-native'
import { logger } from '@baishou/shared'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { mobileAgentDbRecovery } from '../../services/mobile-agent-db-recovery.service'
import { resyncAgentDbCachesFromDisk } from '../../services/mobile-agent-db-resync.util'
import { MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES } from '../../services/mobile-file-read-limits'
import {
  hasStoragePermission,
  isExternalStorageRequiredError
} from '../../services/storage-permission.service'
import { warmAgentScreenCaches } from '../../lib/agent-user-profile.util'
import {
  activateVaultRuntime,
  deleteVaultWithShadowCleanup,
  initVaultLayer,
  registerVaultBootstrapDeps,
  switchVaultRuntime,
  type VaultBoundDiaryStack
} from '../../services/mobile-vault-runtime.service'
import { createMobileRagService } from '../../services/mobile-rag.service'
import { attachMobileRagVaultScope } from '../../services/mobile-rag-vault-scope'
import { setMobileDiaryEmbeddingDeps } from '../../services/mobile-diary-embedding.service'
import { consumeAppUpgradeShadowResync } from '../../services/mobile-app-upgrade-shadow.util'
import { mobileDeveloperService } from '../../services/developer.service'
import { rebindSummaryPipelineForVault } from '../../services/mobile-agent-db-runtime'
import { emitVaultSwitchMutation } from '../../cache/mobile-cache-coordinator'
import { refreshMobileAttachmentPathRemapper } from '../../services/mobile-attachment-path-remapper'
import type { MobileBaishouInitContext } from './init-context'
import type { MobileBaishouCoreState } from './bootstrap-mobile-baishou-core'

export async function finalizeVaultRuntimeHandlers(
  ctx: MobileBaishouInitContext,
  state: MobileBaishouCoreState
): Promise<void> {
  const { refs } = ctx
  const isMounted = ctx.isMounted
  const s = state as Record<string, any>
  const mobileMcpService = s.mobileMcpService
  const vaultService = s.vaultService
  const pathService = s.pathService
  const fileSystem = s.fileSystem
  const vaultRuntimeDeps = s.vaultRuntimeDeps
  const settingsManager = s.settingsManager
  const attachmentManager = s.attachmentManager
  const bootstrapDeps = s.bootstrapDeps
  const watcherDeps = s.watcherDeps
  const registry = s.registry
  const hsRepo = s.hsRepo
  const hybridSearchService = s.hybridSearchService
  const sqlExecutor = s.sqlExecutor
  const ragServiceRef = s.ragServiceRef
  const agentDbRebuiltAtStartup = s.agentDbRebuiltAtStartup
  const updaterService = s.updaterService
  let storageReady = s.storageReady
  const diaryStack = s.diaryStack

  await refreshMobileAttachmentPathRemapper(() => pathService.getRootDirectory()).catch((e) => {
    logger.warn('[BaishouProvider] Failed to register attachment path remapper:', e as Error)
  })

  state.runStorageBootstrap = async (options?: {
    forceDeferResync?: boolean
    resyncReason?: string
  }): Promise<VaultBoundDiaryStack> => {
    const stack = refs.diaryStackRef.current ?? (await initVaultLayer(vaultRuntimeDeps))
    refs.diaryStackRef.current = stack

    const activeVault = vaultService.getActiveVault()
    if (activeVault?.path) {
      const forceShadowResync = await consumeAppUpgradeShadowResync()
      await activateVaultRuntime(
        {
          pathService,
          vaultService,
          fileSystem,
          diaryStack: stack,
          bootstrapDeps,
          watcherDeps
        },
        {
          deferResync: true,
          forceDeferResync: options?.forceDeferResync,
          forceShadowResync,
          resyncReason: options?.resyncReason ?? 'cold-start',
          onResyncComplete: () => {
            if (!isMounted()) return
            ctx.setValue((prev) => ({
              ...prev,
              vaultRevision: prev.vaultRevision + 1
            }))
          }
        }
      )
    } else {
      logger.warn('[BaishouProvider] No active vault; skipped bootstrap and file watcher')
    }

    return stack
  }

  state.runDeferredVaultStartup = async () => {
    if (!isMounted()) return

    if (
      agentDbRebuiltAtStartup &&
      agentDbRuntimeRef.current &&
      vaultService.getActiveVault()?.name
    ) {
      try {
        await mobileAgentDbRecovery.runBare(async () => {
          const { listDiskVaultFolderNames } = await import('@baishou/core-mobile')
          const syncRoot = await pathService.getRootDirectory()
          const diskVaultNames = await listDiskVaultFolderNames(fileSystem, syncRoot)
          await resyncAgentDbCachesFromDisk({
            runtime: agentDbRuntimeRef.current!,
            activeVaultName: vaultService.getActiveVault()?.name,
            diskVaultNames,
            maxSessionJsonReadBytes: MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES
          })
        })
      } catch (e) {
        logger.warn('[BaishouProvider] post-startup-rebuild agent resync failed:', e as Error)
      }
    }

    if (refs.diaryStackRef.current) {
      try {
        await (
          state.runStorageBootstrap as (options?: {
            forceDeferResync?: boolean
            resyncReason?: string
          }) => Promise<VaultBoundDiaryStack>
        )()
      } catch (e) {
        if (Platform.OS === 'android' && isExternalStorageRequiredError(e)) {
          logger.info(
            '[BaishouProvider] Vault bootstrap deferred until external storage is granted'
          )
          if (isMounted()) {
            ctx.setValue((prev) => ({ ...prev, storageReady: false }))
          }
        } else {
          logger.error('[BaishouProvider] Vault bootstrap failed:', e as Error)
          if (isMounted()) {
            ctx.setValue((prev) => ({ ...prev, storageReady: false }))
          }
        }
      }
    }

    if (Platform.OS === 'android') {
      const needsStorageMount = !refs.diaryStackRef.current
      if (needsStorageMount && (await hasStoragePermission())) {
        const mounted = await refs.retryStorageSetupRef.current()
        if (mounted && isMounted()) {
          ctx.setValue((prev) => ({ ...prev, storageReady: true }))
        }
      }
    }

    if (isMounted()) {
      void warmAgentScreenCaches(settingsManager, attachmentManager, fileSystem)
    }

    void mobileMcpService?.start().catch((mcpErr: unknown) => {
      logger.warn('[BaishouProvider] MCP server failed to start:', mcpErr as Error)
    })

    void updaterService.checkOnBootIfEnabled().catch((e: unknown) => {
      logger.warn('[MobileUpdater] boot check failed:', e as Error)
    })
  }

  state.switchVault = async (vaultName: string) => {
    const active = vaultService.getActiveVault()
    if (active?.name === vaultName) {
      return
    }

    if (isMounted()) {
      ctx.setValue((prev) => ({ ...prev, vaultSwitching: true }))
    }

    try {
      const stack = await switchVaultRuntime(vaultName, {
        pathService,
        vaultService,
        fileSystem,
        bootstrapDeps,
        watcherDeps,
        currentStack: refs.diaryStackRef.current ?? undefined,
        callbacks: {
          onStackInvalidated: () => {
            refs.diaryStackRef.current = null
            setMobileDiaryEmbeddingDeps(null)
          },
          onStackReady: (readyStack: VaultBoundDiaryStack) => {
            refs.diaryStackRef.current = readyStack
            const nextRagDeps = attachMobileRagVaultScope(
              {
                settingsManager,
                diaryService: readyStack.diaryService,
                hsRepo,
                hybridSearchService,
                registry,
                rawSqlClient: sqlExecutor
              },
              pathService,
              vaultService
            )
            setMobileDiaryEmbeddingDeps(nextRagDeps, {
              agentDb: agentDbRuntimeRef.current?.drizzleDb ?? null
            })
            ragServiceRef.current = createMobileRagService(nextRagDeps)
          },
          onResyncComplete: () => {
            if (!isMounted()) return
            ctx.setValue((prev) => ({
              ...prev,
              vaultRevision: prev.vaultRevision + 1
            }))
          }
        }
      })

      const runtime = agentDbRuntimeRef.current
      if (runtime && stack && isMounted()) {
        const activeVaultName = vaultService.getActiveVault()?.name ?? null
        const summaryPipeline = await rebindSummaryPipelineForVault({
          drizzleDb: runtime.drizzleDb,
          pathService,
          fileSystem,
          settingsManager,
          diaryRepoAdapter: stack.diaryRepoAdapter,
          activeVaultName
        })
        bootstrapDeps.summarySyncService = summaryPipeline.summarySyncService
        watcherDeps.summarySyncService = summaryPipeline.summarySyncService
        registerVaultBootstrapDeps(stack, bootstrapDeps)
        agentDbRuntimeRef.current = {
          ...runtime,
          summaryManager: summaryPipeline.summaryManager,
          summaryGenerator: summaryPipeline.summaryGenerator,
          missingSummaryDetector: summaryPipeline.missingSummaryDetector,
          summarySyncService: summaryPipeline.summarySyncService
        }
        ctx.setValue((prev) => ({
          ...prev,
          vaultRevision: prev.vaultRevision + 1,
          services: prev.services
            ? {
                ...prev.services,
                ragService: ragServiceRef.current,
                summaryManager: summaryPipeline.summaryManager,
                summaryGenerator: summaryPipeline.summaryGenerator,
                missingSummaryDetector: summaryPipeline.missingSummaryDetector,
                switchVault: state.switchVault as (vaultName: string) => Promise<void>,
                deleteVault: state.deleteVault as (vaultName: string) => Promise<void>
              }
            : prev.services
        }))
      }

      emitVaultSwitchMutation(vaultName)
      await refreshMobileAttachmentPathRemapper(() => pathService.getRootDirectory()).catch((e) => {
        logger.warn('[BaishouProvider] Failed to refresh attachment path remapper:', e as Error)
      })
    } catch (e) {
      logger.error('[BaishouProvider] switchVault failed:', e as Error)
      throw e
    } finally {
      if (isMounted()) {
        ctx.setValue((prev) => ({ ...prev, vaultSwitching: false }))
      }
    }
  }

  state.deleteVault = async (vaultName: string) => {
    await deleteVaultWithShadowCleanup(vaultName, { vaultService })
    if (isMounted()) {
      ctx.setValue((prev) => ({
        ...prev,
        vaultRevision: prev.vaultRevision + 1
      }))
    }
  }

  state.createDemoVault = async () => {
    const result = await mobileDeveloperService.createDemoVault({
      vaultService,
      switchVault: state.switchVault as (vaultName: string) => Promise<void>,
      getDiaryService: () => {
        const stack = refs.diaryStackRef.current
        if (!stack) {
          throw new Error('Diary stack unavailable')
        }
        return stack.diaryService
      },
      getSummaryManager: () => agentDbRuntimeRef.current?.summaryManager
    })
    if (isMounted()) {
      ctx.setValue((prev) => ({
        ...prev,
        vaultRevision: prev.vaultRevision + 1
      }))
    }
    return result
  }

  if (diaryStack) {
    storageReady = true
  }
  state.storageReady = storageReady
}
