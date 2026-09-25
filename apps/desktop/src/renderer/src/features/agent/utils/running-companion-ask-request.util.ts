import {
  AgentGateKind,
  AgentGateRequestStatus,
  normalizeCompanionAskQuestions,
  type AgentGateRequest,
  type AgentStreamTimelineItem
} from '@baishou/shared'

const LOCAL_ASK_PREFIX = 'local-companion-ask:'

function readArgsRecord(args: unknown): Record<string, unknown> | null {
  if (typeof args === 'string') {
    const trimmed = args.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null
  return args as Record<string, unknown>
}

function readStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const labels = value.filter((item): item is string => typeof item === 'string')
  return labels.length === value.length ? labels : undefined
}

/** 流式工具行里已经有完整问题时，先在输入框上方挂出确认卡，不必再等收件箱事件。 */
export function buildRunningCompanionAskRequest(
  sessionId: string,
  timeline: readonly AgentStreamTimelineItem[]
): AgentGateRequest | null {
  const running = [...timeline].reverse().find(
    (item) => item.kind === 'tool' && item.name === 'companion_ask' && item.status === 'running'
  )
  if (!running || running.kind !== 'tool') return null
  const record = readArgsRecord(running.arguments)
  if (!record) return null

  const question = typeof record.question === 'string' ? record.question : undefined
  const options = readStringList(record.options)
  const allowCustomInput =
    typeof record.allow_custom_input === 'boolean' ? record.allow_custom_input : undefined
  const rawQuestions = Array.isArray(record.questions) ? record.questions : undefined
  const questions = normalizeCompanionAskQuestions({
    question,
    options,
    allowCustomInput,
    questions: rawQuestions
      ?.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const row = item as Record<string, unknown>
        if (typeof row.question !== 'string') return null
        return {
          question: row.question,
          options: readStringList(row.options),
          allowCustomInput:
            typeof row.allow_custom_input === 'boolean' ? row.allow_custom_input : undefined
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
  })
  const first = questions[0]
  if (!first) return null

  return {
    id: `${LOCAL_ASK_PREFIX}${running.callId}`,
    sessionId,
    vaultName: '',
    status: AgentGateRequestStatus.Pending,
    kind: AgentGateKind.Proactive,
    action: 'companion_ask',
    title: first.question,
    options: first.options,
    allowCustomInput: questions.some((item) => item.allowCustomInput),
    questions,
    metadata: {},
    scope: { kind: 'companion' },
    toolCallId: running.callId,
    createdAt: running.startTime ?? 0
  }
}

export function isLocalCompanionAskRequestId(requestId: string): boolean {
  return requestId.startsWith(LOCAL_ASK_PREFIX)
}

export function findSessionCompanionAskRequest(
  pending: readonly AgentGateRequest[],
  sessionId: string
): AgentGateRequest | undefined {
  return pending.find(
    (item) =>
      item.sessionId === sessionId &&
      item.action === 'companion_ask' &&
      !isLocalCompanionAskRequestId(item.id)
  )
}

export function resolveCompanionAskDockRequest(input: {
  pendingGate: AgentGateRequest | null
  sessionId?: string
  timeline: readonly AgentStreamTimelineItem[]
  isStreaming: boolean
}): AgentGateRequest | null {
  if (input.pendingGate) return input.pendingGate
  if (!input.isStreaming || !input.sessionId) return null
  return buildRunningCompanionAskRequest(input.sessionId, input.timeline)
}

export async function waitForLiveCompanionAskRequest(input: {
  sessionId: string
  listPending: (sessionId?: string) => Promise<unknown>
  readInbox: () => readonly AgentGateRequest[]
  attempts?: number
  delayMs?: number
}): Promise<AgentGateRequest | undefined> {
  const attempts = input.attempts ?? 8
  const delayMs = input.delayMs ?? 150
  for (let index = 0; index < attempts; index++) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * index))
    }
    const fromInbox = findSessionCompanionAskRequest(input.readInbox(), input.sessionId)
    if (fromInbox) return fromInbox
    const scoped = await input.listPending(input.sessionId)
    const fromScoped = findSessionCompanionAskRequest(
      Array.isArray(scoped) ? scoped : [],
      input.sessionId
    )
    if (fromScoped) return fromScoped
    const all = await input.listPending()
    const fromAll = findSessionCompanionAskRequest(Array.isArray(all) ? all : [], input.sessionId)
    if (fromAll) return fromAll
  }
  return undefined
}
