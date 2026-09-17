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
import { createMobileFileSystem } from './create-mobile-file-system'
import {
  mobileGraphExtractQueue,
  type MobileGraphExtractContext
} from './mobile-graph-extract-queue.service'
import {
  mobileListPendingReextract,
  resolveMobileGraphExtractAlignDeps
} from './mobile-graph.service'

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

    const alignDeps = await resolveMobileGraphExtractAlignDeps(ctx)
    if (!(await alignDeps.isEmbeddingConfigured?.())) return 0

    const records = await shadowRepo.getAllRecords()
    const record = records.find((row) => String(row.id) === diaryId)
    const filePath = record?.filePath
    if (!filePath) return 0
    if (alignDeps.isDiaryEmbedded && !(await alignDeps.isDiaryEmbedded(filePath))) {
      return 0
    }

    const pending = await mobileListPendingReextract(ctx)
    const wanted = selectDiaryGraphFollowUpItems({
      wanted: [{ filePath, date: record?.date, contentHash: input.contentHash }],
      pendingReextract: pending
    })
    const { items } = await buildGraphExtractEnqueueItems({
      wanted: wanted.map((row) => row.filePath),
      pending,
      isDiaryEmbedded: alignDeps.isDiaryEmbedded
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
