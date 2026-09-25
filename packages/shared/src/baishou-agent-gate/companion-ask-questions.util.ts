import type {
  AgentGateQuestion,
  AgentGateQuestionAnswer,
  AgentGateRequest
} from './agent-gate.types'

export interface CompanionAskQuestionInput {
  question: string
  options?: string[]
  allowCustomInput?: boolean
}

export interface CompanionAskDraftAnswer {
  questionId: string
  selectedOptionId?: string | null
  message?: string
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
  questions?: CompanionAskQuestionInput[]
}): AgentGateQuestion[] {
  if (input.questions && input.questions.length > 0) {
    return input.questions
      .map((item, index) => ({
        id: String(index),
        question: item.question.trim(),
        options: mapOptionLabels(item.options),
        allowCustomInput: item.allowCustomInput ?? true
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
      allowCustomInput: input.allowCustomInput ?? true
    }
  ]
}

export function resolveCompanionAskQuestions(
  request: Pick<AgentGateRequest, 'title' | 'options' | 'allowCustomInput' | 'questions'>
): AgentGateQuestion[] {
  if (request.questions && request.questions.length > 0) return request.questions
  if (!request.title.trim() && request.options.length === 0) return []
  return [
    {
      id: '0',
      question: request.title,
      options: request.options,
      allowCustomInput: request.allowCustomInput
    }
  ]
}

export function companionAskAnswersComplete(
  questions: AgentGateQuestion[],
  drafts: CompanionAskDraftAnswer[]
): boolean {
  if (questions.length === 0) return false
  return questions.every((question) => {
    const draft = drafts.find((item) => item.questionId === question.id)
    if (!draft) return false
    if (draft.selectedOptionId) return true
    return Boolean(question.allowCustomInput && draft.message?.trim())
  })
}

export function buildCompanionAskQuestionAnswers(
  questions: AgentGateQuestion[],
  drafts: CompanionAskDraftAnswer[]
): AgentGateQuestionAnswer[] {
  return questions.map((question) => {
    const draft = drafts.find((item) => item.questionId === question.id)
    return {
      questionId: question.id,
      selectedOptionIds: draft?.selectedOptionId ? [draft.selectedOptionId] : [],
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
  const selectedId = selectedOptionIds[0]
  const selectedLabel =
    selectedId != null
      ? question.options.find((option) => option.id === selectedId)?.label
      : undefined
  const answer =
    selectedLabel ?? matched?.message ?? (singleQuestion ? (resolution.message ?? null) : null)
  return { answer: answer ?? null, selectedOptionIds }
}