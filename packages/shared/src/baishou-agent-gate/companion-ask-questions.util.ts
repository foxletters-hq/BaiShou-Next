import type {
  AgentGateQuestion,
  AgentGateQuestionAnswer,
  AgentGateRequest
} from './agent-gate.types'

export interface CompanionAskQuestionInput {
  question: string
  options?: string[]
  allowCustomInput?: boolean
  multiple?: boolean
}

export interface CompanionAskDraftAnswer {
  questionId: string
  selectedOptionId?: string | null
  selectedOptionIds?: string[]
  message?: string
}

function getDraftSelectedOptionIds(draft: CompanionAskDraftAnswer | undefined): string[] {
  if (!draft) return []
  if (Array.isArray(draft.selectedOptionIds) && draft.selectedOptionIds.length > 0) {
    return draft.selectedOptionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  }
  return draft.selectedOptionId ? [draft.selectedOptionId] : []
}

function mapOptionLabels(labels: string[] | undefined) {
  return (labels ?? [])
    .map((label, index) => ({
      id: String(index),
      label: label.trim()
    }))
    .filter((option) => option.label.length > 0)
}

/** 把单题或 questions 收成同一份确认卡题目 */
export function normalizeCompanionAskQuestions(input: {
  question?: string
  options?: string[]
  allowCustomInput?: boolean
  multiple?: boolean
  questions?: CompanionAskQuestionInput[]
}): AgentGateQuestion[] {
  if (input.questions && input.questions.length > 0) {
    return input.questions
      .map((item, index) => ({
        id: String(index),
        question: item.question.trim(),
        options: mapOptionLabels(item.options),
        allowCustomInput: item.allowCustomInput ?? true,
        ...(item.multiple ?? (input.questions!.length === 1 ? input.multiple : undefined)
          ? { multiple: true }
          : {})
      }))
      .filter((item) => item.question.length > 0)
  }

  const question = input.question?.trim()
  if (!question) return []
  return [
    {
      id: '0',
      question,
      options: mapOptionLabels(input.options),
      allowCustomInput: input.allowCustomInput ?? true,
      ...(input.multiple ? { multiple: true } : {})
    }
  ]
}

export function resolveCompanionAskQuestions(
  request: Pick<
    AgentGateRequest,
    'title' | 'options' | 'allowCustomInput' | 'multiple' | 'questions'
  >
): AgentGateQuestion[] {
  if (request.questions && request.questions.length > 0) {
    return request.questions.map((item, index) =>
      index === 0 && request.multiple && !item.multiple ? { ...item, multiple: true } : item
    )
  }
  if (!request.title.trim() && request.options.length === 0) return []
  return [
    {
      id: '0',
      question: request.title,
      options: request.options,
      allowCustomInput: request.allowCustomInput,
      ...(request.multiple ? { multiple: true } : {})
    }
  ]
}

export function companionAskQuestionAnswered(
  question: AgentGateQuestion,
  draft: CompanionAskDraftAnswer | undefined
): boolean {
  if (!draft) return false
  if (getDraftSelectedOptionIds(draft).length > 0) return true
  return Boolean(question.allowCustomInput && draft.message?.trim())
}

export function companionAskAnswersComplete(
  questions: AgentGateQuestion[],
  drafts: CompanionAskDraftAnswer[]
): boolean {
  if (questions.length === 0) return false
  return questions.every((question) =>
    companionAskQuestionAnswered(
      question,
      drafts.find((item) => item.questionId === question.id)
    )
  )
}

export function buildCompanionAskQuestionAnswers(
  questions: AgentGateQuestion[],
  drafts: CompanionAskDraftAnswer[]
): AgentGateQuestionAnswer[] {
  return questions.map((question) => {
    const draft = drafts.find((item) => item.questionId === question.id)
    const selectedOptionIds = getDraftSelectedOptionIds(draft)
    return {
      questionId: question.id,
      selectedOptionIds,
      message: draft?.message?.trim() || undefined
    }
  })
}

export function readQuestionAnswer(
  question: AgentGateQuestion,
  resolution: {
    questionAnswers?: AgentGateQuestionAnswer[]
    selectedOptionIds?: string[]
    message?: string
  },
  singleQuestion: boolean
): { answer: string | null; selectedOptionIds: string[] } {
  const matched = resolution.questionAnswers?.find((item) => item.questionId === question.id)
  const selectedOptionIds =
    matched?.selectedOptionIds ?? (singleQuestion ? (resolution.selectedOptionIds ?? []) : [])
  const selectedLabels = selectedOptionIds
    .map((id) => question.options.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label))
  const customMessage =
    matched?.message?.trim() || (singleQuestion ? resolution.message?.trim() : undefined)
  const answer =
    selectedLabels.length > 0
      ? question.multiple && customMessage
        ? [...selectedLabels, customMessage].join('、')
        : selectedLabels.join('、')
      : (customMessage ?? null)
  return { answer: answer ?? null, selectedOptionIds }
}
