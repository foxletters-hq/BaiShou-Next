import { createStore } from '../create-store'

export type RecompressStatus = 'running' | 'done' | 'error'

export interface RecompressJob {
  sessionId: string
  status: RecompressStatus
  /** 任务开始时间戳（ms），用于展示已用时长 */
  startedAt: number
  /** 完成或失败的更新时间戳（ms） */
  updatedAt: number
  summaryText?: string
  error?: string
}

export interface RecompressResult {
  ok: boolean
  summaryText?: string
  error?: string
  errorCode?: string
}

interface ContextCompressionState {
  jobs: Record<string, RecompressJob>
}

interface ContextCompressionActions {
  /**
   * 触发重新压缩。任务状态保存在全局 store，组件卸载（如切换日记/伙伴页）后仍然保留，
   * 重新进入会话时可继续展示进度，完成后返回结果。
   */
  runRecompress: (sessionId: string) => Promise<RecompressResult>
  clearError: (sessionId: string) => void
  clearJob: (sessionId: string) => void
  getJob: (sessionId: string) => RecompressJob | undefined
}

type RecompressInvoker = (sessionId: string) => Promise<RecompressResult>

let recompressInvoker: RecompressInvoker | null = null

/** 移动端等非 Electron 环境注入重压缩实现；未注入时回退桌面 IPC。 */
export function setContextRecompressInvoker(invoker: RecompressInvoker | null): void {
  recompressInvoker = invoker
}

function invokeRecompress(sessionId: string): Promise<RecompressResult> {
  if (recompressInvoker) {
    return recompressInvoker(sessionId)
  }
  const ipc = (globalThis as any)?.window?.electron?.ipcRenderer
  if (!ipc?.invoke) {
    return Promise.resolve({ ok: false, error: 'IPC unavailable' })
  }
  return ipc.invoke('agent:recompress-context', sessionId) as Promise<RecompressResult>
}

export const useContextCompressionStore = createStore<
  ContextCompressionState & ContextCompressionActions
>('ContextCompressionStore', (set, get) => ({
  jobs: {},

  getJob: (sessionId) => get().jobs[sessionId],

  runRecompress: async (sessionId) => {
    if (!sessionId) return { ok: false, error: 'No session' }
    const existing = get().jobs[sessionId]
    if (existing?.status === 'running') {
      return {
        ok: false,
        error: '该会话正在重新压缩，请稍候。',
        errorCode: 'compress.already_running'
      }
    }

    const startedAt = Date.now()
    set((state: ContextCompressionState) => ({
      jobs: {
        ...state.jobs,
        [sessionId]: { sessionId, status: 'running', startedAt, updatedAt: startedAt }
      }
    }))

    try {
      const result = await invokeRecompress(sessionId)
      if (result?.ok && result.summaryText) {
        set((state: ContextCompressionState) => ({
          jobs: {
            ...state.jobs,
            [sessionId]: {
              sessionId,
              status: 'done',
              startedAt,
              updatedAt: Date.now(),
              summaryText: result.summaryText
            }
          }
        }))
        return result
      }
      const error = result?.error || 'Re-compression failed'
      set((state: ContextCompressionState) => ({
        jobs: {
          ...state.jobs,
          [sessionId]: { sessionId, status: 'error', startedAt, updatedAt: Date.now(), error }
        }
      }))
      return { ok: false, error }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e)
      set((state: ContextCompressionState) => ({
        jobs: {
          ...state.jobs,
          [sessionId]: { sessionId, status: 'error', startedAt, updatedAt: Date.now(), error }
        }
      }))
      return { ok: false, error }
    }
  },

  clearError: (sessionId) =>
    set((state: ContextCompressionState) => {
      const job = state.jobs[sessionId]
      if (!job || job.status !== 'error') return state
      const next = { ...state.jobs }
      delete next[sessionId]
      return { jobs: next }
    }),

  clearJob: (sessionId) =>
    set((state: ContextCompressionState) => {
      if (!state.jobs[sessionId]) return state
      const next = { ...state.jobs }
      delete next[sessionId]
      return { jobs: next }
    })
}))
