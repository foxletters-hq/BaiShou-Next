/**
 * 兼容网关会在工具名到达时就发出 tool-input-start，但要等整段连接结束才发出可执行的 tool-call。
 * 连接若在参数收齐后不再收尾，确认卡就永远不会出现。
 * 参数串一旦能解析成完整提问，就立刻开门，不必再等连接结束。
 */

export interface CompanionAskStreamQuestion {
  question: string
  options?: string[]
  allow_custom_input?: boolean
}

export interface CompanionAskStreamArgs {
  question?: string
  options?: string[]
  allow_custom_input?: boolean
  questions?: CompanionAskStreamQuestion[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function readQuestion(value: unknown): CompanionAskStreamQuestion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.question !== 'string' || !record.question.trim()) return null
  if (record.options != null && !isStringArray(record.options)) return null
  if (record.allow_custom_input != null && typeof record.allow_custom_input !== 'boolean') {
    return null
  }
  return {
    question: record.question,
    ...(record.options ? { options: record.options } : {}),
    ...(typeof record.allow_custom_input === 'boolean'
      ? { allow_custom_input: record.allow_custom_input }
      : {})
  }
}

/** 只接受已经收口、并且至少有一道题的参数。半截 JSON 返回 null。 */
export function parseCompanionAskStreamArgs(buffer: string): CompanionAskStreamArgs | null {
  const trimmed = buffer.trim()
  if (!trimmed.endsWith('}')) return null
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  let questions: CompanionAskStreamQuestion[] | undefined
  if (record.questions != null) {
    if (!Array.isArray(record.questions)) return null
    const parsed = record.questions.map((item) => readQuestion(item))
    if (parsed.some((item) => item == null)) return null
    questions = parsed as CompanionAskStreamQuestion[]
  }

  const single = typeof record.question === 'string' ? readQuestion(record) : null
  if (typeof record.question === 'string' && !single) return null
  if (!single && (!questions || questions.length === 0)) return null

  return {
    ...(single
      ? {
          question: single.question,
          ...(single.options ? { options: single.options } : {}),
          ...(single.allow_custom_input != null
            ? { allow_custom_input: single.allow_custom_input }
            : {})
        }
      : {}),
    ...(questions ? { questions } : {})
  }
}

function stringifyAskInput(input: unknown): string {
  if (typeof input === 'string') return input
  try {
    return JSON.stringify(input ?? {})
  } catch {
    return ''
  }
}

/**
 * 同一 callId 只开一次门。流式片段先攒着，解析成功才执行；
 * 之后模型侧的 execute 复用同一次等待，避免再弹一张卡。
 */
export class CompanionAskStreamSession {
  private readonly buffers = new Map<string, string>()
  private readonly inflight = new Map<string, Promise<string>>()

  constructor(private readonly run: (args: CompanionAskStreamArgs) => Promise<string>) {}

  peekInflight(): Promise<string> | undefined {
    for (const pending of this.inflight.values()) return pending
    return undefined
  }

  pushDelta(toolCallId: string, delta: string): void {
    if (!toolCallId || this.inflight.has(toolCallId)) return
    const next = (this.buffers.get(toolCallId) ?? '') + (delta ?? '')
    this.buffers.set(toolCallId, next)
    const parsed = parseCompanionAskStreamArgs(next)
    if (!parsed) return
    this.claim(toolCallId, parsed)
  }

  claim(toolCallId: string, args: CompanionAskStreamArgs): Promise<string> {
    if (!toolCallId) {
      const existing = this.peekInflight()
      if (existing) return existing
      toolCallId = 'pending'
    }
    const existing = this.inflight.get(toolCallId) ?? this.peekInflight()
    if (existing) return existing
    const pending = this.run(args)
    this.inflight.set(toolCallId, pending)
    return pending
  }
}

type CompanionAskVercelTool = {
  execute?: (args: CompanionAskStreamArgs, options?: { toolCallId?: string }) => unknown
}

const streamSessions = new Map<string, CompanionAskStreamSession>()

/** 把本轮 companion_ask 的流式会话挂到 sessionId 上，开门时不必再碰 SDK 可能抽走的 execute。 */
export function registerCompanionAskStreamSession(
  sessionId: string,
  session: CompanionAskStreamSession
): () => void {
  if (!sessionId) return () => {}
  streamSessions.set(sessionId, session)
  return () => {
    if (streamSessions.get(sessionId) === session) streamSessions.delete(sessionId)
  }
}

export function peekCompanionAskInflight(sessionId: string): Promise<string> | undefined {
  return streamSessions.get(sessionId)?.peekInflight()
}

/** 用户还没答完时，流结束不能把确认门拆掉。 */
export function shouldKeepCompanionAskAfterStream(
  pending: readonly { action?: string }[]
): boolean {
  return pending.some((request) => request.action === 'companion_ask')
}

export async function waitCompanionAskInflight(sessionId: string): Promise<void> {
  const pending = peekCompanionAskInflight(sessionId)
  if (!pending) return
  try {
    await pending
  } catch {
    // 拒绝 / 取消由工具写成结果，这里只挡住流提前收尾
  }
}

export function clearCompanionAskStreamSessionsForTests(): void {
  streamSessions.clear()
}

/** 流式 TOOL_CALL 一旦带上完整提问，立刻开门，不必再等 SDK 的 execute。 */
export function startCompanionAskFromStreamInput(
  tools: Record<string, unknown>,
  input: { toolName?: string; toolCallId?: string; input?: unknown },
  sessionId?: string
): void {
  if (input.toolName !== 'companion_ask' || !input.toolCallId) return
  const parsed = parseCompanionAskStreamArgs(stringifyAskInput(input.input))
  if (!parsed) return
  try {
    if (sessionId) {
      const session = streamSessions.get(sessionId)
      if (session) {
        void session.claim(input.toolCallId, parsed)
        return
      }
    }
    const tool = tools.companion_ask as CompanionAskVercelTool | undefined
    if (!tool?.execute) return
    void tool.execute(parsed, { toolCallId: input.toolCallId })
  } catch {
    // 开门失败不阻断正文流
  }
}
