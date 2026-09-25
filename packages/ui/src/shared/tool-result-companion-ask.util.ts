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

function readCompanionAskQuestionItems(
  args: Record<string, unknown> | null
): Array<{ question: string; options: CompanionAskOptionView[] }> {
  if (!args || !Array.isArray(args.questions)) return []
  return args.questions
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      const question = readArgString(record.question)
      if (!question) return null
      return {
        question,
        options: readCompanionAskOptions(record)
      }
    })
    .filter((item): item is { question: string; options: CompanionAskOptionView[] } => item != null)
}

function readCompanionAskDeclined(obj: Record<string, unknown>): boolean {
  return obj.declined === true || obj.approved === false
}

function readCompanionAskResultObject(obj: Record<string, unknown>): {
  question?: string
  answer: string | null
  selectedOptionIds: string[]
  answers: Array<{ question?: string; answer: string | null; selectedOptionIds: string[] }>
} {
  const answer = typeof obj.answer === 'string' && obj.answer.trim() ? obj.answer.trim() : null
  const selectedOptionIds = Array.isArray(obj.selectedOptionIds)
    ? obj.selectedOptionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const answers = Array.isArray(obj.answers)
    ? obj.answers
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const record = item as Record<string, unknown>
          return {
            question: readArgString(record.question),
            answer:
              typeof record.answer === 'string' && record.answer.trim()
                ? record.answer.trim()
                : null,
            selectedOptionIds: Array.isArray(record.selectedOptionIds)
              ? record.selectedOptionIds.filter(
                  (id): id is string => typeof id === 'string' && id.length > 0
                )
              : []
          }
        })
        .filter(
          (
            item
          ): item is { question?: string; answer: string | null; selectedOptionIds: string[] } =>
            item != null
        )
    : []
  return {
    question: readArgString(obj.question),
    answer,
    selectedOptionIds,
    answers
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
  answers: Array<{ question?: string; answer: string | null; selectedOptionIds: string[] }>
  declined: boolean
} | null {
  if (result == null) {
    return { answer: null, selectedOptionIds: [], answers: [], declined: false }
  }

  if (typeof result === 'string') {
    const trimmed = result.trim()
    if (!trimmed) return { answer: null, selectedOptionIds: [], answers: [], declined: false }
    if (isCompanionAskDeclineRaw(trimmed)) {
      return { answer: null, selectedOptionIds: [], answers: [], declined: true }
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
    return { answer: trimmed, selectedOptionIds: [], answers: [], declined: false }
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
  const questionItems = readCompanionAskQuestionItems(args)
  const fromArgsQuestion = args ? readArgString(args.question) : undefined
  const fromResult = parseCompanionAskResultPayload(invocation.result)
  if (!fromResult && !fromArgsQuestion && options.length === 0 && questionItems.length === 0) {
    return null
  }

  const question = fromResult?.question ?? fromArgsQuestion ?? questionItems[0]?.question ?? ''
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

  if (!question && !answer && !declined && displayOptions.length === 0 && questionItems.length === 0) {
    return null
  }

  const resolvedSelectedIds =
    selectedOptionIds.length > 0
      ? selectedOptionIds
      : answer
        ? [displayOptions.find((option) => option.label === answer)?.id ?? 'custom']
        : []

  const resultAnswers = fromResult && 'answers' in fromResult ? fromResult.answers : []
  const items =
    questionItems.length > 1 || resultAnswers.length > 1
      ? (questionItems.length > 0 ? questionItems : resultAnswers).map((item, index) => {
          const resultItem = resultAnswers[index]
          const itemQuestion =
            ('question' in item && item.question ? item.question : resultItem?.question) || ''
          const itemOptions = 'options' in item ? item.options : []
          let itemAnswer = declined ? null : (resultItem?.answer ?? null)
          const itemSelected = resultItem?.selectedOptionIds ?? []
          if (!itemAnswer && itemSelected.length > 0) {
            itemAnswer = itemOptions.find((option) => option.id === itemSelected[0])?.label ?? null
          }
          const itemDisplay = [...itemOptions]
          if (itemAnswer && !itemDisplay.some((option) => option.label === itemAnswer)) {
            itemDisplay.push({ id: itemSelected[0] ?? 'custom', label: itemAnswer })
          }
          return {
            question: itemQuestion,
            answer: itemAnswer,
            options: itemDisplay,
            selectedOptionIds: itemSelected
          }
        })
      : undefined

  return {
    mode: 'companion_ask',
    question,
    answer,
    declined,
    options: displayOptions,
    selectedOptionIds: resolvedSelectedIds,
    items
  }
}
