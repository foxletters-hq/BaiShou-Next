import type { AgentGateConfigScope, AgentGateRequest } from '@baishou/shared'
import { createStore } from '../create-store'

function sortByCreatedAt(requests: AgentGateRequest[]): AgentGateRequest[] {
  return [...requests].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.id.localeCompare(b.id)
  })
}

function scopeKey(scope: AgentGateConfigScope | undefined): string {
  if (!scope || scope.kind === 'companion') return 'companion'
  return `workspace:${scope.workspaceId}`
}

/** 短生命周期墓碑：防止过期 listPending 把已回复项复活 */
const repliedTombstones = new Map<string, number>()
const TOMBSTONE_TTL_MS = 60_000

function pruneTombstones(now = Date.now()): void {
  for (const [id, at] of repliedTombstones.entries()) {
    if (now - at > TOMBSTONE_TTL_MS) repliedTombstones.delete(id)
  }
}

function markRepliedTombstone(requestId: string): void {
  repliedTombstones.set(requestId, Date.now())
}

function isRepliedTombstone(requestId: string): boolean {
  pruneTombstones()
  return repliedTombstones.has(requestId)
}

export interface AgentGateInboxState {
  /** 全局待确认队列（按 createdAt 排序后的真相源） */
  pending: AgentGateRequest[]
  /** 用户在某一会话中手动聚焦的 requestId */
  focusedRequestIdBySession: Record<string, string | null>
  /** 水合是否完成（至少成功一次 listPending） */
  hydrated: boolean
}

export interface AgentGateHydrateOptions {
  /**
   * 发起 listPending 前的本地 id 快照。
   * 水合后仅额外保留「快照之后新插入」的竞态 asks；快照内但服务端已消失的项会被剪掉。
   */
  snapshotIdsAtFetchStart?: ReadonlySet<string>
}

export interface AgentGateInboxActions {
  upsertAsked: (request: AgentGateRequest) => void
  removeReplied: (requestId: string) => void
  hydrate: (requests: AgentGateRequest[], options?: AgentGateHydrateOptions) => void
  replaceAll: (requests: AgentGateRequest[]) => void
  setFocusedRequest: (sessionId: string, requestId: string | null) => void
  clearSession: (sessionId: string) => void
  reset: () => void
}

export type AgentGateInboxStore = AgentGateInboxState & AgentGateInboxActions

const initialState: AgentGateInboxState = {
  pending: [],
  focusedRequestIdBySession: {},
  hydrated: false
}

export const useAgentGateInboxStore = createStore<AgentGateInboxStore>(
  'AgentGateInboxStore',
  (set) => ({
    ...initialState,

    upsertAsked: (request) => {
      if (!request?.id) return
      repliedTombstones.delete(request.id)
      set((state: AgentGateInboxState) => {
        const without = state.pending.filter((item) => item.id !== request.id)
        return { pending: sortByCreatedAt([...without, request]) }
      })
    },

    removeReplied: (requestId) => {
      if (!requestId) return
      markRepliedTombstone(requestId)
      set((state: AgentGateInboxState) => {
        const pending = state.pending.filter((item) => item.id !== requestId)
        const focusedRequestIdBySession = { ...state.focusedRequestIdBySession }
        for (const [sessionId, focusedId] of Object.entries(focusedRequestIdBySession)) {
          if (focusedId === requestId) {
            focusedRequestIdBySession[sessionId] = null
          }
        }
        return { pending, focusedRequestIdBySession }
      })
    },

    /**
     * 权威水合：以服务端列表为准剪枝幽灵 pending。
     * 若传入 snapshotIdsAtFetchStart，则额外保留水合期间竞态插入的 asks。
     * 已 removeReplied 的墓碑 id 不会被过期 list 结果复活。
     */
    hydrate: (requests, options) => {
      const incoming = Array.isArray(requests) ? requests.filter((r) => r?.id) : []
      const snapshot = options?.snapshotIdsAtFetchStart
      pruneTombstones()
      set((state: AgentGateInboxState) => {
        const racedLive = snapshot
          ? state.pending.filter((item) => !snapshot.has(item.id))
          : []
        const byId = new Map<string, AgentGateRequest>()
        for (const item of incoming) {
          if (isRepliedTombstone(item.id)) continue
          byId.set(item.id, item)
        }
        for (const item of racedLive) {
          if (isRepliedTombstone(item.id)) continue
          byId.set(item.id, item)
        }
        return {
          pending: sortByCreatedAt([...byId.values()]),
          hydrated: true
        }
      })
    },

    replaceAll: (requests) => {
      set({
        pending: sortByCreatedAt(Array.isArray(requests) ? requests.filter((r) => r?.id) : []),
        hydrated: true
      })
    },

    setFocusedRequest: (sessionId, requestId) => {
      if (!sessionId) return
      set((state: AgentGateInboxState) => ({
        focusedRequestIdBySession: {
          ...state.focusedRequestIdBySession,
          [sessionId]: requestId
        }
      }))
    },

    clearSession: (sessionId) => {
      if (!sessionId) return
      set((state: AgentGateInboxState) => {
        const pending = state.pending.filter((item) => item.sessionId !== sessionId)
        const focusedRequestIdBySession = { ...state.focusedRequestIdBySession }
        delete focusedRequestIdBySession[sessionId]
        return { pending, focusedRequestIdBySession }
      })
    },

    reset: () => {
      repliedTombstones.clear()
      set({ ...initialState })
    }
  })
)

const EMPTY_PENDING: AgentGateRequest[] = []
const EMPTY_QUEUE_POSITION = Object.freeze({ index: 0, total: 0 })

export type AgentGateGroupedPending = {
  groupKey: string
  scope: AgentGateConfigScope | undefined
  vaultName: string
  sessionId: string
  requests: AgentGateRequest[]
}

const EMPTY_GROUPED_PENDING: AgentGateGroupedPending[] = []

/** selectGroupedPending 按 pending 引用缓存，避免每次 getSnapshot 新数组导致无限重渲染 */
let groupedPendingCacheSource: AgentGateRequest[] | null = null
let groupedPendingCacheResult: AgentGateGroupedPending[] = EMPTY_GROUPED_PENDING

export function selectAllPending(state: AgentGateInboxState): AgentGateRequest[] {
  return state.pending
}

export function selectPendingCount(state: AgentGateInboxState): number {
  return state.pending.length
}

export function selectPendingForSession(
  state: AgentGateInboxState,
  sessionId: string | null | undefined
): AgentGateRequest[] {
  if (!sessionId) return EMPTY_PENDING
  return state.pending.filter((item) => item.sessionId === sessionId)
}

export function selectPendingForScope(
  state: AgentGateInboxState,
  scope: AgentGateConfigScope | undefined
): AgentGateRequest[] {
  const key = scopeKey(scope)
  return state.pending.filter((item) => scopeKey(item.scope) === key)
}

/**
 * 当前会话应展示的活动请求：优先 focused（仍 pending），否则队列首项。
 */
export function selectActivePendingForSession(
  state: AgentGateInboxState,
  sessionId: string | null | undefined
): AgentGateRequest | null {
  const queue = selectPendingForSession(state, sessionId)
  if (queue.length === 0 || !sessionId) return null
  const focusedId = state.focusedRequestIdBySession[sessionId]
  if (focusedId) {
    const focused = queue.find((item) => item.id === focusedId)
    if (focused) return focused
  }
  return queue[0] ?? null
}

export function selectQueuePosition(
  state: AgentGateInboxState,
  sessionId: string | null | undefined,
  requestId: string | null | undefined
): { index: number; total: number } {
  const queue = selectPendingForSession(state, sessionId)
  if (queue.length === 0) return EMPTY_QUEUE_POSITION
  if (!requestId) {
    return { index: 0, total: queue.length }
  }
  const index = queue.findIndex((item) => item.id === requestId)
  return {
    index: index >= 0 ? index + 1 : 0,
    total: queue.length
  }
}

/** 同会话中与当前请求相同 action 的数量（含自身），用于 Always/Reject 级联提示 */
export function selectSameActionCountInSession(
  state: AgentGateInboxState,
  sessionId: string | null | undefined,
  action: string | null | undefined
): number {
  if (!sessionId || !action) return 0
  return selectPendingForSession(state, sessionId).filter((item) => item.action === action).length
}

export function selectGroupedPending(state: AgentGateInboxState): AgentGateGroupedPending[] {
  if (groupedPendingCacheSource === state.pending) {
    return groupedPendingCacheResult
  }

  if (state.pending.length === 0) {
    groupedPendingCacheSource = state.pending
    groupedPendingCacheResult = EMPTY_GROUPED_PENDING
    return EMPTY_GROUPED_PENDING
  }

  const groups = new Map<string, AgentGateGroupedPending>()

  for (const request of state.pending) {
    const key = `${scopeKey(request.scope)}::${request.sessionId}`
    const existing = groups.get(key)
    if (existing) {
      existing.requests.push(request)
    } else {
      groups.set(key, {
        groupKey: key,
        scope: request.scope,
        vaultName: request.vaultName,
        sessionId: request.sessionId,
        requests: [request]
      })
    }
  }

  const result = [...groups.values()].map((group) => ({
    ...group,
    requests: sortByCreatedAt(group.requests)
  }))
  groupedPendingCacheSource = state.pending
  groupedPendingCacheResult = result
  return result
}

/** 非 React 场景读取当前快照 */
export function getAgentGateInboxSnapshot(): AgentGateInboxStore {
  return useAgentGateInboxStore.getState()
}

/** 测试辅助：清空墓碑 */
export function clearAgentGateInboxTombstonesForTests(): void {
  repliedTombstones.clear()
}
