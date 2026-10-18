import {
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  buildGraphExtractEnqueueItems,
  getUserProfileFromSettings,
  logger,
  resolveGraphExtractSelfName,
  selectDiaryGraphFollowUpItems
} from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import {
  mobileGraphExtractQueue,
  type MobileGraphExtractContext
} from './mobile-graph-extract-queue.service'
import {
  mobileListPendingReextract,
  resolveMobileGraphExtractAlignDeps
} from './mobile-graph.service'

type CachedMobileFollowContext = {
  vaultId: string
  timestamp: number
  alignDeps: Awaited<ReturnType<typeof resolveMobileGraphExtractAlignDeps>>
  pending: Awaited<ReturnType<typeof mobileListPendingReextract>>
  justEmbeddedDiaryIds: Set<string>
}

let cachedMobileFollowContext: CachedMobileFollowContext | null = null

export function clearMobileDiaryGraphFollowPendingCache(): void {
  cachedMobileFollowContext = null
}

/**
 * 日记原文向量完成后自动接抽图。未配置自称或队列未就绪时安静跳过，不拆门槛错误码。
 */
export async function scheduleMobileDiaryGraphAfterEmbed(input: {
  vaultId: string
  diaryId: number | string
  contentHash?: string
}): Promise<number> {
  const vaultId = String(input.vaultId || '').trim()
  const diaryId = String(input.diaryId ?? '').trim()
  if (!vaultId || !diaryId) return 0

  try {
    const runtime = agentDbRuntimeRef.current
    if (!runtime?.settingsManager || !runtime.pathService || !runtime.drizzleDb) return 0
    if (!shadowConnectionManager.isConnected()) return 0

    const flag = await runtime.settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
    const profile = await getUserProfileFromSettings(runtime.settingsManager)
    const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
    if (!selfName) return 0

    const vaultName =
      (await runtime.pathService.getActiveVaultNameForContext().catch(() => '')) || 'Personal'
    const { createMobileFileSystem } = await import('./create-mobile-file-system')
    const fileSystem = createMobileFileSystem()
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
    const ctx: MobileGraphExtractContext = {
      vaultId,
      vaultName,
      drizzleDb: runtime.drizzleDb,
      shadowRepo,
      pathService: runtime.pathService,
      fileSystem,
      settingsManager: runtime.settingsManager
    }

    const now = Date.now()
    let cached = cachedMobileFollowContext
    if (!cached || cached.vaultId !== vaultId || now - cached.timestamp >= 5000) {
      const alignDeps = await resolveMobileGraphExtractAlignDeps(ctx)
      if (!(await alignDeps.isEmbeddingConfigured?.())) return 0
      const pending = await mobileListPendingReextract(ctx)
      cached = {
        vaultId,
        timestamp: now,
        alignDeps,
        pending,
        justEmbeddedDiaryIds: new Set<string>()
      }
      cachedMobileFollowContext = cached
    }
    cached.justEmbeddedDiaryIds.add(diaryId)

    const numericId = Number(diaryId)
    const record =
      typeof shadowRepo.findById === 'function'
        ? !Number.isNaN(numericId)
          ? await shadowRepo.findById(numericId)
          : null
        : (await shadowRepo.getAllRecords()).find((row) => String(row.id) === diaryId)
    const filePath = record?.filePath
    if (!filePath) return 0

    const isDiaryEmbedded = async (path: string) => {
      if (cached!.justEmbeddedDiaryIds.has(diaryId)) return true
      return (await cached!.alignDeps.isDiaryEmbedded?.(path)) ?? false
    }

    if (!(await isDiaryEmbedded(filePath))) {
      return 0
    }

    const wanted = selectDiaryGraphFollowUpItems({
      wanted: [{ filePath, date: record?.date, contentHash: input.contentHash }],
      pendingReextract: cached.pending
    })
    const { items } = await buildGraphExtractEnqueueItems({
      wanted: wanted.map((row) => row.filePath),
      pending: cached.pending,
      isDiaryEmbedded
    })
    if (items.length === 0) return 0
    return mobileGraphExtractQueue.enqueueAfterEmbed(
      items.map((item) => ({
        ...item,
        contentHash: wanted[0]?.contentHash || input.contentHash
      })),
      ctx
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === GRAPH_SELF_NAME_REQUIRED_ERROR) return 0
    logger.warn('[MobileDiaryGraphFollow] 向量完成后自动接抽图失败', error as Error)
    return 0
  }
}
