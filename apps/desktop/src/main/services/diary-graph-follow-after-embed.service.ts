import {
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  buildGraphExtractEnqueueItems,
  logger,
  resolveGraphExtractSelfName,
  selectDiaryGraphFollowUpItems
} from '@baishou/shared'
import { connectionManager, UserProfileRepository } from '@baishou/database-desktop'
import { getActiveVaultShadowRepo } from '../ipc/vault.ipc'
import { getDerivedFreshness } from './raw-data-source.runtime'
import { GraphExtractQueueService } from './graph-extract-queue.service'
import { resolveDesktopGraphExtractAlignDeps } from './graph-extract-embed-gate'

/**
 * 日记原文向量完成后自动接抽图。门槛错误码仍由抽取侧抛出；这里只入队，不拆安全网。
 */
export async function scheduleDiaryGraphAfterEmbed(input: {
  vaultId: string
  diaryId: number | string
  contentHash?: string
}): Promise<number> {
  const vaultId = String(input.vaultId || '').trim()
  const diaryId = String(input.diaryId ?? '').trim()
  if (!vaultId || !diaryId) return 0

  try {
    const { settingsManager } = await import('../ipc/settings.ipc')
    const flag = await settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
    if (!connectionManager.isConnected()) return 0
    const profile = await new UserProfileRepository(connectionManager.getDb()).getProfile()
    const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
    if (!selfName) return 0

    const alignDeps = await resolveDesktopGraphExtractAlignDeps(vaultId)
    if (!(await alignDeps.isEmbeddingConfigured?.())) return 0

    const records = await getActiveVaultShadowRepo().getAllRecords()
    const record = records.find((row) => String(row.id) === diaryId)
    const filePath = record?.filePath
    if (!filePath) return 0
    if (alignDeps.isDiaryEmbedded && !(await alignDeps.isDiaryEmbedded(filePath))) {
      return 0
    }

    const pending = await getDerivedFreshness().listPendingReextract()
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
    return GraphExtractQueueService.getInstance().enqueueAfterEmbed(
      items.map((item) => ({
        ...item,
        contentHash: wanted[0]?.contentHash || input.contentHash
      }))
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === GRAPH_SELF_NAME_REQUIRED_ERROR) return 0
    logger.warn('[DiaryGraphFollow] 向量完成后自动接抽图失败', error as Error)
    return 0
  }
}
