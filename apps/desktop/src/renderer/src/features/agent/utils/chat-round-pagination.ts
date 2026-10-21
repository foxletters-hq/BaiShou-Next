/** 每页（隐藏分页）包含的对话轮数 */
export const CHAT_ROUNDS_PER_PAGE = 6

/** 单次从数据库拉取的消息上限（需足够覆盖若干轮，含工具调用） */
export const CHAT_MESSAGE_FETCH_LIMIT = 60

/** 流结束 / 增量同步时仅拉取尾部消息条数（覆盖一轮含工具调用的常见上限） */
export const CHAT_TAIL_FETCH_LIMIT = 8

/**
 * 参考 OpenCode `leadingTurnPageLimit = 3`：
 * 当窗口首轮缺失父级 `user` 消息或单页消息不足目标轮数时，自动向数据库继续补拉的最大页数。
 */
export const CHAT_LEADING_ROUND_MAX_ENRICH_PAGES = 3

export type ChatLikeMessage = {
  id: string
  role: string
  orderIndex?: number
}

/** 按用户消息切分对话轮次（一轮 = 从用户消息到下一轮用户消息之前） */
export function groupMessagesIntoRounds<T extends ChatLikeMessage>(messages: readonly T[]): T[][] {
  const rounds: T[][] = []
  let bucket: T[] = []

  const flush = () => {
    if (bucket.length === 0) return
    rounds.push(bucket)
    bucket = []
  }

  for (const msg of messages) {
    if (msg.role === 'user' && bucket.length > 0) {
      flush()
    }
    bucket.push(msg)
  }
  flush()

  return rounds
}

/**
 * 参考 OpenCode `leadingTurnNeedsParent`：
 * 检查当前已拉取消息的最早一轮是否缺少父级 `user` 消息（即因按条数拉取截断在半轮中间，首条 `assistant` 出现在首条 `user` 之前）。
 */
export function leadingRoundNeedsParent<T extends ChatLikeMessage>(
  messages: readonly T[]
): boolean {
  const firstAssistantIndex = messages.findIndex((msg) => msg.role === 'assistant')
  if (firstAssistantIndex === -1) return false
  const firstUserIndex = messages.findIndex((msg) => msg.role === 'user')
  return firstUserIndex === -1 || firstAssistantIndex < firstUserIndex
}

/**
 * 将更早一页消息前插到现有列表头部，并按 id 去重。
 */
export function prependOlderRoundMessages<T extends { id: string }>(
  current: readonly T[],
  olderPage: readonly T[]
): T[] {
  if (olderPage.length === 0) return [...current]
  const existingIds = new Set(current.map((item) => item.id))
  const uniqueOlder = olderPage.filter((item) => !existingIds.has(item.id))
  return [...uniqueOlder, ...current]
}

/**
 * 判断当前缓存是否还需要继续从数据库拉取更早一页才能凑齐完整轮数：
 * 1. 若数据库已无更多（!fetchHasMore），无需再拉；
 * 2. 若缓存总轮数不足 targetVisibleRounds，需要继续拉；
 * 3. 若窗口起点落到第 0 轮，且第 0 轮缺失父级 `user` 消息（被条数分页截断的半轮），需要继续拉以补齐该轮的 `user` 起点。
 */
export function cacheNeedsMoreForRoundWindow<T extends ChatLikeMessage>(
  cache: readonly T[],
  targetVisibleRounds: number,
  fetchHasMore: boolean
): boolean {
  if (!fetchHasMore) return false
  const rounds = groupMessagesIntoRounds(cache)
  if (rounds.length < targetVisibleRounds) return true
  const start = Math.max(0, rounds.length - targetVisibleRounds)
  if (start === 0 && leadingRoundNeedsParent(cache)) return true
  return false
}

/**
 * 参考 OpenCode `enrichLeadingTurn`：
 * 当缓存中的完整轮数不足 `targetVisibleRounds`（或窗口首轮缺失父级 `user` 消息）且数据库仍有更早消息时，
 * 自动继续拉取最多 `maxPages` 页，确保严格按完整轮数展示，不露出半轮。
 */
export async function enrichCacheForRoundWindow<T extends ChatLikeMessage>(params: {
  cache: T[]
  loadedFromEnd: number
  fetchHasMore: boolean
  targetVisibleRounds: number
  fetchPage: (limit: number, offset: number) => Promise<T[] | null>
  isCurrent?: () => boolean
  pageLimit?: number
  maxPages?: number
}): Promise<{
  cache: T[]
  loadedFromEnd: number
  fetchHasMore: boolean
}> {
  const pageLimit = params.pageLimit ?? CHAT_MESSAGE_FETCH_LIMIT
  const maxPages = params.maxPages ?? CHAT_LEADING_ROUND_MAX_ENRICH_PAGES
  let cache = params.cache
  let loadedFromEnd = params.loadedFromEnd
  let fetchHasMore = params.fetchHasMore
  let pagesFetched = 0

  while (
    pagesFetched < maxPages &&
    cacheNeedsMoreForRoundWindow(cache, params.targetVisibleRounds, fetchHasMore)
  ) {
    if (params.isCurrent && !params.isCurrent()) break
    const fetched = await params.fetchPage(pageLimit, loadedFromEnd)
    if (params.isCurrent && !params.isCurrent()) break
    if (!fetched?.length) {
      fetchHasMore = false
      break
    }
    pagesFetched += 1
    fetchHasMore = fetched.length >= pageLimit
    loadedFromEnd += fetched.length
    cache = prependOlderRoundMessages(cache, fetched)
  }

  return { cache, loadedFromEnd, fetchHasMore }
}

/** 从第 startRoundIndex 轮起直到末尾的扁平消息列表 */
export function flattenRoundSlice<T extends ChatLikeMessage>(
  rounds: readonly T[][],
  startRoundIndex: number
): T[] {
  if (rounds.length === 0) return []
  const start = Math.max(0, Math.min(startRoundIndex, rounds.length - 1))
  if (start === 0 && rounds.length === 1) return [...rounds[0]!]
  return rounds.slice(start).flat()
}

/** 首屏：仅展示尾部 CHAT_ROUNDS_PER_PAGE 轮 */
export function computeInitialRoundWindowStart(totalRounds: number): number {
  return Math.max(0, totalRounds - CHAT_ROUNDS_PER_PAGE)
}

/** 上滑加载：窗口向前扩展 CHAT_ROUNDS_PER_PAGE 轮 */
export function expandRoundWindowStart(currentStart: number): number {
  return Math.max(0, currentStart - CHAT_ROUNDS_PER_PAGE)
}

export function isRoundPageStart(roundIndex: number): boolean {
  return roundIndex >= 0 && roundIndex % CHAT_ROUNDS_PER_PAGE === 0
}

export function buildRoundIndexByMessageId<T extends ChatLikeMessage>(
  messages: readonly T[]
): Map<string, number> {
  const rounds = groupMessagesIntoRounds(messages)
  const map = new Map<string, number>()
  rounds.forEach((round, roundIndex) => {
    for (const msg of round) {
      map.set(msg.id, roundIndex)
    }
  })
  return map
}
