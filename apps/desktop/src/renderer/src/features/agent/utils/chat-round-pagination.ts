/** 每页（隐藏分页）包含的对话轮数 */
export const CHAT_ROUNDS_PER_PAGE = 3

/** 单次从数据库拉取的消息上限（需足够覆盖若干轮，含工具调用） */
export const CHAT_MESSAGE_FETCH_LIMIT = 60

/** 流结束 / 增量同步时仅拉取尾部消息条数（覆盖一轮含工具调用的常见上限） */
export const CHAT_TAIL_FETCH_LIMIT = 8

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
    if (msg.role === 'user' && bucket.some((m) => m.role === 'user')) {
      flush()
    }
    bucket.push(msg)
  }
  flush()

  return rounds
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
