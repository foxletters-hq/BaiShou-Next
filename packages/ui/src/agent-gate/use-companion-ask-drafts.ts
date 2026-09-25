import { useEffect, useMemo, useState } from 'react'
import {
  companionAskAnswersComplete,
  type AgentGateQuestion,
  type CompanionAskDraftAnswer
} from '@baishou/shared'

export function useCompanionAskDrafts(questions: AgentGateQuestion[]) {
  const questionKey = questions.map((item) => item.id).join(':')
  const [selectedById, setSelectedById] = useState<Record<string, string>>({})
  const [customById, setCustomById] = useState<Record<string, string>>({})
  const [customOpenId, setCustomOpenId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedById({})
    setCustomById({})
    setCustomOpenId(null)
  }, [questionKey])

  const drafts = useMemo<CompanionAskDraftAnswer[]>(
    () =>
      questions.map((item) => ({
        questionId: item.id,
        selectedOptionId: selectedById[item.id] ?? null,
        message: customById[item.id]
      })),
    [customById, questions, selectedById]
  )

  const complete = companionAskAnswersComplete(questions, drafts)

  const selectOption = (questionId: string, optionId: string) => {
    setSelectedById((prev) => ({ ...prev, [questionId]: optionId }))
    setCustomById((prev) => ({ ...prev, [questionId]: '' }))
    setCustomOpenId((prev) => (prev === questionId ? null : prev))
  }

  const setCustomMessage = (questionId: string, message: string) => {
    setCustomById((prev) => ({ ...prev, [questionId]: message }))
    setSelectedById((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  return {
    drafts,
    complete,
    selectedById,
    customById,
    customOpenId,
    setCustomOpenId,
    selectOption,
    setCustomMessage
  }
}