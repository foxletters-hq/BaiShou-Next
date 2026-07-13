import { appendDiagnosticBreadcrumb } from '../services/mobile-diagnostic-log.service'

const MAX_RECENT_EVENTS = 80
const recentEvents: string[] = []

export type AgentScrollDebugContext = {
  sessionId?: string | null
  messagesCount?: number
  visibleMessagesCount?: number
  isStreaming?: boolean
  isStreamBridgeActive?: boolean
  showStreamingFooter?: boolean
  showStreamingBubble?: boolean
  assistantPersistedInList?: boolean
  followMode?: string
  newestRole?: string
  /** 输出结束后短窗：用于标出「结束期拽底」嫌疑事件 */
  postStreamWatch?: boolean
}

/** 列表 offset / 内容高度快照，便于对照钳位 */
export type AgentScrollSnapshot = {
  offsetY?: number
  contentH?: number
  viewportH?: number
  maxOffset?: number
  nearBottom?: boolean
  lockedAway?: boolean
  followMode?: string
  anchorMinH?: number
  peakContentH?: number
}

let debugContext: AgentScrollDebugContext = {}

export function setAgentScrollDebugContext(ctx: AgentScrollDebugContext): void {
  debugContext = { ...debugContext, ...ctx }
}

export function getAgentScrollDebugContext(): AgentScrollDebugContext {
  return debugContext
}

export function getRecentAgentScrollEvents(): readonly string[] {
  return recentEvents
}

/**
 * 开发态滚动诊断：同时写入 Metro 与诊断日志（设置 → 关于 → 复制诊断日志）。
 */
export function logAgentScrollEvent(tag: string, payload: Record<string, unknown> = {}): void {
  logAgentDiagnostic('scroll', tag, payload)
}

/** UI 交接诊断：气泡模式切换、组件挂载点变化 */
export function logAgentUiEvent(tag: string, payload: Record<string, unknown> = {}): void {
  logAgentDiagnostic('ui', tag, payload)
}

function logAgentDiagnostic(
  channel: 'scroll' | 'ui',
  tag: string,
  payload: Record<string, unknown>
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return

  const line = `[${channel}:${tag}] ${JSON.stringify({ ...debugContext, ...payload })}`

  console.log(line)
  appendDiagnosticBreadcrumb(line)

  recentEvents.push(line)
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift()
  }
}
