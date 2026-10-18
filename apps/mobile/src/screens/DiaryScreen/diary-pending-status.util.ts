import {
  EMPTY_PENDING_EMBED_COUNTS,
  isRagEmbedFeatureConfigured,
  pendingOrganizeArticleCount,
  shouldShowPendingEmbed,
  shouldShowPendingExtract,
  type GlobalModelsConfig,
  type PendingEmbedCounts,
  type RagConfig
} from '@baishou/shared'

export type DiaryOrganizePendingSnapshot = PendingEmbedCounts & {
  graphExtract: number
}

export type DiaryPendingStatusView = {
  pendingGraphCount: number
  pendingEmbedCount: number
  pendingEmbedParts: PendingEmbedCounts
  graphConfigured: boolean
  ragConfigured: boolean
}

export const EMPTY_DIARY_PENDING_STATUS: DiaryPendingStatusView = {
  pendingGraphCount: 0,
  pendingEmbedCount: 0,
  pendingEmbedParts: EMPTY_PENDING_EMBED_COUNTS,
  graphConfigured: false,
  ragConfigured: false
}

export function diaryPendingStatusFromSnapshot(
  snapshot: DiaryOrganizePendingSnapshot | null | undefined,
  ragConfigured: boolean
): DiaryPendingStatusView | null {
  if (!snapshot) return null
  return {
    pendingGraphCount: snapshot.graphExtract,
    pendingEmbedCount: snapshot.total,
    pendingEmbedParts: snapshot,
    graphConfigured: true,
    ragConfigured
  }
}

export function initialDiaryPendingStatusFromSnapshot(
  snapshot: DiaryOrganizePendingSnapshot | null | undefined
): DiaryPendingStatusView {
  return diaryPendingStatusFromSnapshot(snapshot, true) ?? EMPTY_DIARY_PENDING_STATUS
}

export async function loadDiaryPendingStatus(input: {
  getSnapshot: () => Promise<DiaryOrganizePendingSnapshot | null | undefined>
  getRagConfig: () => Promise<RagConfig | null | undefined>
  getGlobalModels: () => Promise<GlobalModelsConfig | null | undefined>
  fallbackSnapshot?: DiaryOrganizePendingSnapshot | null
}): Promise<{ view: DiaryPendingStatusView; ragConfig: RagConfig | null }> {
  const [snapshot, ragConfig, globalModels] = await Promise.all([
    input.getSnapshot().catch(() => input.fallbackSnapshot ?? null),
    input.getRagConfig().catch(() => null),
    input.getGlobalModels().catch(() => null)
  ])
  const ragConfigured = isRagEmbedFeatureConfigured({
    ragConfig,
    globalModels
  })
  const counts = snapshot ?? input.fallbackSnapshot ?? null
  return {
    view: diaryPendingStatusFromSnapshot(counts, ragConfigured) ?? {
      ...EMPTY_DIARY_PENDING_STATUS,
      graphConfigured: true,
      ragConfigured
    },
    ragConfig: ragConfig ?? null
  }
}

/** 现场刷新已经落地后，不再用本地缓存快照盖回去。 */
export function shouldHydrateDiaryPendingSnapshot(input: {
  liveApplied: boolean
  current: Pick<DiaryPendingStatusView, 'pendingEmbedCount' | 'pendingGraphCount'>
}): boolean {
  if (input.liveApplied) return false
  return input.current.pendingEmbedCount <= 0 && input.current.pendingGraphCount <= 0
}

/** 过期请求返回 null，表示不要写进界面；失败则保留切页前的底栏。 */
export function resolveDiaryPendingStatusRefresh(input: {
  requestId: number
  latestRequestId: number
  previous: DiaryPendingStatusView
  next: DiaryPendingStatusView | null
  failed: boolean
}): DiaryPendingStatusView | null {
  if (input.requestId !== input.latestRequestId) return null
  if (input.failed || !input.next) return input.previous
  return input.next
}

/** 日记底栏与记忆页整理按钮同一套篇数，不把抽图队列和嵌入队列加总。 */
export function diaryPendingOrganizeCount(input: {
  graphConfigured: boolean
  ragConfigured: boolean
  pendingGraphCount: number
  pendingEmbedCount: number
  pendingDiaryCount?: number
}): number {
  return pendingOrganizeArticleCount({
    pendingGraphCount: shouldShowPendingExtract({
      graphConfigured: input.graphConfigured,
      count: input.pendingGraphCount
    })
      ? input.pendingGraphCount
      : 0,
    pendingEmbedCount: shouldShowPendingEmbed({
      ragConfigured: input.ragConfigured,
      count: input.pendingEmbedCount
    })
      ? input.pendingEmbedCount
      : 0,
    pendingDiaryCount: input.pendingDiaryCount
  })
}
