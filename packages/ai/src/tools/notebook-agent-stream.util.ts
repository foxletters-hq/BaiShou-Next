export type NotebookAgentToolStatus = 'running' | 'done' | 'failed'

export type NotebookAgentToolEvent = {
  name: string
  status: NotebookAgentToolStatus
  result?: string
}

export type NotebookAgentStreamPart = {
  type?: string
  textDelta?: string
  text?: string
  toolName?: string
  name?: string
  toolCallId?: string
  result?: unknown
  output?: unknown
  error?: unknown
  errorText?: string
  toolCall?: { toolName?: string; name?: string }
}

export type NotebookAgentStreamState = {
  text: string
  reasoning: string
  lastToolName?: string
}

function readPartText(part: NotebookAgentStreamPart): string {
  return part.textDelta ?? part.text ?? ''
}

function readToolName(part: NotebookAgentStreamPart, fallback = ''): string {
  return String(
    part.toolName || part.name || part.toolCall?.toolName || part.toolCall?.name || fallback
  ).trim()
}

function readToolResult(part: NotebookAgentStreamPart): string {
  const raw = part.result ?? part.output ?? part.errorText ?? part.error
  if (typeof raw === 'string') return raw
  if (raw == null) return ''
  try {
    return JSON.stringify(raw)
  } catch {
    return String(raw)
  }
}

const TOOL_START_TYPES = new Set([
  'tool-call',
  'tool-call-streaming-start',
  'tool-input-start'
])

const TOOL_RESULT_TYPES = new Set(['tool-result', 'tool-output-available'])

const TOOL_FAIL_TYPES = new Set(['tool-error', 'tool-output-error', 'tool-output-denied'])

export function applyNotebookAgentStreamPart(
  part: NotebookAgentStreamPart,
  state: NotebookAgentStreamState
): NotebookAgentStreamState & { tool?: NotebookAgentToolEvent } {
  const type = String(part.type || '')
  if (type === 'error') {
    const message =
      part.error instanceof Error ? part.error.message : String(part.error ?? 'Notebook agent stream error')
    throw new Error(message)
  }
  if (type === 'abort') {
    throw new DOMException('The operation was aborted', 'AbortError')
  }
  if (type === 'reasoning-delta' || type === 'reasoning') {
    const next = state.reasoning + readPartText(part)
    return { ...state, reasoning: next }
  }
  if (type === 'text-delta' || type === 'text') {
    const next = state.text + readPartText(part)
    return { ...state, text: next }
  }
  if (TOOL_START_TYPES.has(type)) {
    const name = readToolName(part)
    if (!name) return state
    return { ...state, lastToolName: name, tool: { name, status: 'running' } }
  }
  if (TOOL_RESULT_TYPES.has(type) || TOOL_FAIL_TYPES.has(type)) {
    const name = readToolName(part, state.lastToolName || '')
    if (!name) return state
    const result = readToolResult(part)
    const failed = TOOL_FAIL_TYPES.has(type) || /失败|不可用|损坏/.test(result)
    return {
      ...state,
      lastToolName: name,
      tool: { name, status: failed ? 'failed' : 'done', result }
    }
  }
  return state
}
