import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  cacheNeedsMoreForRoundWindow,
  computeInitialRoundWindowStart,
  enrichCacheForRoundWindow,
  expandRoundWindowStart,
  flattenRoundSlice,
  groupMessagesIntoRounds,
  leadingRoundNeedsParent,
  prependOlderRoundMessages,
  type ChatLikeMessage
} from '../../agent/utils/chat-round-pagination'

/** 工作台每页展示的对话轮数（与伙伴页一致：每页 3 轮） */
export const WORKSPACE_ROUNDS_PER_PAGE = CHAT_ROUNDS_PER_PAGE

/** 工作台单次从数据库拉取的消息条数（含工具 / 思考 parts） */
export const WORKSPACE_MESSAGE_PAGE_SIZE = CHAT_MESSAGE_FETCH_LIMIT

export {
  cacheNeedsMoreForRoundWindow,
  computeInitialRoundWindowStart,
  enrichCacheForRoundWindow,
  expandRoundWindowStart,
  flattenRoundSlice,
  groupMessagesIntoRounds,
  leadingRoundNeedsParent
}

export function workspaceHasMoreMessages(
  fetchedCount: number,
  requestedLimit: number = WORKSPACE_MESSAGE_PAGE_SIZE
): boolean {
  return fetchedCount >= requestedLimit
}

export function prependOlderWorkspaceMessages<T extends { id: string }>(
  current: readonly T[],
  olderPage: readonly T[]
): T[] {
  return prependOlderRoundMessages(current, olderPage)
}

export function resolveWorkspaceHasMore(roundWindowStart: number, fetchHasMore: boolean): boolean {
  return roundWindowStart > 0 || fetchHasMore
}

export function isViewingLatestWorkspaceRounds<T extends ChatLikeMessage>(
  cache: readonly T[],
  roundWindowStart: number
): boolean {
  const totalRounds = groupMessagesIntoRounds(cache).length
  return roundWindowStart >= Math.max(0, totalRounds - WORKSPACE_ROUNDS_PER_PAGE)
}

export function resolveWorkspaceRoundWindowStart<T extends ChatLikeMessage>(
  cache: readonly T[],
  currentStart: number,
  preserveWindow: boolean
): number {
  const totalRounds = groupMessagesIntoRounds(cache).length
  const initialStart = computeInitialRoundWindowStart(totalRounds)
  if (!preserveWindow) return initialStart
  return Math.min(currentStart, initialStart)
}

export function applyWorkspaceCacheToRoundWindow<T extends ChatLikeMessage>(
  cache: readonly T[],
  roundWindowStart: number,
  fetchHasMore: boolean
): { display: T[]; hasMore: boolean; roundWindowStart: number } {
  const rounds = groupMessagesIntoRounds(cache)
  let clampedStart = Math.min(roundWindowStart, computeInitialRoundWindowStart(rounds.length))
  if (clampedStart === 0 && fetchHasMore && rounds.length > 1 && leadingRoundNeedsParent(cache)) {
    clampedStart = 1
  }
  const display = flattenRoundSlice(rounds, clampedStart)
  return {
    display,
    hasMore: resolveWorkspaceHasMore(clampedStart, fetchHasMore),
    roundWindowStart: clampedStart
  }
}
