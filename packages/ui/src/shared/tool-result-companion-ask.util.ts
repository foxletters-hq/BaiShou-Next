import { isAgentGateRejectedError, isCompanionAskCancelledMessage } from '@baishou/shared'
import { readArgString, readArgsRecord, readInvocationToolName } from './tool-result-args.util'
import type {
  CompanionAskOptionView,
  CompanionAskPresentation,
  ToolInvocationLike
} from './tool-result.types'

const COMPANION_ASK_DECLINED = /^User declined to answer\.?$/i

export function isCompanionAskDeclinedNotice(text: string): boolean {
  return COMPANION_ASK_DECLINED.test(text.trim())
}

function readCompanionAskOptions(args: Record<string, unknown> | null): CompanionAskOptionView[] {
  if (!args || !Array.isArray(args.options)) return []
  return args.options
    .map((label, index) => ({
      id: String(index),
      label: typeof label === 'string' ? label.trim() : ''
    }))
    .filter((option) => option.label.length > 0)
}

function readCompanionAskDeclined(obj: Record<string, unknown>): boolean {
  return obj.declined === true || obj.approved === false
}

function readCompanionAskResultObject(obj: Record<string, unknown>): {
  question?: string
  answer: string | null
  selectedOptionIds: string[]
} {
  const answer = typeof obj.answer === 'string' && obj.answer.trim() ? obj.answer.trim() : null
  const selectedOptionIds = Array.isArray(obj.selectedOptionIds)
    ? obj.selectedOptionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  return {
    question: readArgString(obj.question),
    answer,
    selectedOptionIds
  }
}

export function isCompanionAskDeclineRaw(raw: string): boolean {
  const trimmed = raw.trim()
  if (isCompanionAskDeclinedNotice(trimmed)) return true
  if (isCompanionAskCancelledMessage(trimmed)) return true
  if (isAgentGateRejectedError(trimmed)) return true
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return readCompanionAskDeclined(parsed as Record<string, unknown>)
    }
  } catch {
    return false
  }
  return false
}

function parseCompanionAskResultPayload(result: unknown): {
  question?: string
  answer: string | null
  selectedOptionIds: string[]
  declined: boolean
} | null {
  if (result == null) {
    return { answer: null, selectedOptionIds: [], declined: false }
  }

  if (typeof result === 'string') {
    const trimmed = result.trim()
    if (!trimmed) return { answer: null, selectedOptionIds: [], declined: false }
    if (isCompanionAskDeclineRaw(trimmed)) {
      return { answer: null, selectedOptionIds: [], declined: true }
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...readCompanionAskResultObject(parsed as Record<string, unknown>),
          declined: readCompanionAskDeclined(parsed as Record<string, unknown>)
        }
      }
    } catch {
      // 门禁纠正时会直接返回用户自定义文本
    }
    return { answer: trimmed, selectedOptionIds: [], declined: false }
  }

  if (typeof result === 'object' && !Array.isArray(result)) {
    return {
      ...readCompanionAskResultObject(result as Record<string, unknown>),
      declined: readCompanionAskDeclined(result as Record<string, unknown>)
    }
  }

  return null
}

/** 把 companion_ask 的工具结果收成问题 / 选项 / 已选答案，不把底层 JSON 交给界面 */
export function resolveCompanionAskPresentation(
  invocation: ToolInvocationLike
): CompanionAskPresentation | null {
  if (readInvocationToolName(invocation) !== 'companion_ask') return null

  const args = readArgsRecord(invocation.args)
  const options = readCompanionAskOptions(args)
  const fromArgsQuestion = args ? readArgString(args.question) : undefined
  const fromResult = parseCompanionAskResultPayload(invocation.result)
  if (!fromResult && !fromArgsQuestion && options.length === 0) return null

  const question = fromResult?.question ?? fromArgsQuestion ?? ''
  const declined = fromResult?.declined ?? false
  const selectedOptionIds = fromResult?.selectedOptionIds ?? []
  let answer = declined ? null : (fromResult?.answer ?? null)

  if (!answer && selectedOptionIds.length > 0) {
    const matched = options.find((option) => option.id === selectedOptionIds[0])
    if (matched) answer = matched.label
  }

  const displayOptions = [...options]
  if (answer && !displayOptions.some((option) => option.label === answer)) {
    displayOptions.push({
      id: selectedOptionIds[0] ?? 'custom',
      label: answer
    })
  }

  if (!question && !answer && !declined && displayOptions.length === 0) return null

  const resolvedSelectedIds =
    selectedOptionIds.length > 0
      ? selectedOptionIds
      : answer
        ? [displayOptions.find((option) => option.label === answer)?.id ?? 'custom']
        : []

  return {
    mode: 'companion_ask',
    question,
    answer,
    declined,
    options: displayOptions,
    selectedOptionIds: resolvedSelectedIds
  }
}
