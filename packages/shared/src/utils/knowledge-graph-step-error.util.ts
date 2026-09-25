export const KNOWLEDGE_GRAPH_STEPS = ['extract', 'align', 'node-embed'] as const

export type KnowledgeGraphStep = (typeof KNOWLEDGE_GRAPH_STEPS)[number]

const PREFIX = 'graph-step:'

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error ?? '')
}

export function parseKnowledgeGraphStepError(
  error: unknown
): { step: KnowledgeGraphStep; detail: string } | null {
  const message = readErrorMessage(error).trim()
  if (!message.startsWith(PREFIX)) return null
  const rest = message.slice(PREFIX.length)
  const sep = rest.indexOf(':')
  if (sep <= 0) return null
  const step = rest.slice(0, sep)
  if (!KNOWLEDGE_GRAPH_STEPS.includes(step as KnowledgeGraphStep)) return null
  return {
    step: step as KnowledgeGraphStep,
    detail: rest.slice(sep + 1)
  }
}

export function wrapKnowledgeGraphStepError(step: KnowledgeGraphStep, error: unknown): Error {
  const parsed = parseKnowledgeGraphStepError(error)
  if (parsed) return error instanceof Error ? error : new Error(`${PREFIX}${parsed.step}:${parsed.detail}`)
  const detail = readErrorMessage(error)
  return new Error(`${PREFIX}${step}:${detail}`)
}

/** 已经带步骤前缀时保持原步骤，否则记到当前环节。 */
export function rethrowKnowledgeGraphStepError(step: KnowledgeGraphStep, error: unknown): never {
  throw wrapKnowledgeGraphStepError(step, error)
}

export function knowledgeGraphStepDetail(error: unknown): string {
  return parseKnowledgeGraphStepError(error)?.detail || readErrorMessage(error)
}
