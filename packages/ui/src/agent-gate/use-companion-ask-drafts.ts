import { useEffect, useMemo, useState } from 'react'
import {
  companionAskAnswersComplete,
  type AgentGateQuestion,
  type CompanionAskDraftAnswer
} from '@baishou/shared'

export function useCompanionAskDrafts(questions: AgentGateQuestion[]) {
  const questionKey = questions.map((item) => item.id).join(':')
  const [selectedIdsById, setSelectedIdsById] = useState<Record<string, string[]>>({})
  const [customById, setCustomById] = useState<Record<string, string>>({})
  const [customOpenId, setCustomOpenId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedIdsById({})
    setCustomById({})
    setCustomOpenId(null)
  }, [questionKey])

  const selectedById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const [key, ids] of Object.entries(selectedIdsById)) {
      if (ids[0]) map[key] = ids[0]
    }
    return map
  }, [selectedIdsById])

  const drafts = useMemo<CompanionAskDraftAnswer[]>(
    () =>
      questions.map((item) => {
        const selectedOptionIds = selectedIdsById[item.id] ?? []
        return {
          questionId: item.id,
          selectedOptionId: selectedOptionIds[0] ?? null,
          selectedOptionIds,
          message: customById[item.id]
        }
      }),
    [customById, questions, selectedIdsById]
  )

  const complete = companionAskAnswersComplete(questions, drafts)

  const selectOption = (questionId: string, optionId: string) => {
    const question = questions.find((item) => item.id === questionId)
    if (question?.multiple) {
      setSelectedIdsById((prev) => {
        const current = prev[questionId] ?? []
        const exists = current.includes(optionId)
        const rawNext = exists ? current.filter((id) => id !== optionId) : [...current, optionId]
        const order = new Map(question.options.map((opt, idx) => [opt.id, idx]))
        const nextIds = [...rawNext].sort(
          (a, b) =>
            (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER)
        )
        return { ...prev, [questionId]: nextIds }
      })
      return
    }
    setSelectedIdsById((prev) => ({ ...prev, [questionId]: [optionId] }))
    setCustomById((prev) => ({ ...prev, [questionId]: '' }))
    setCustomOpenId((prev) => (prev === questionId ? null : prev))
  }

  const openCustom = (questionId: string) => {
    const question = questions.find((item) => item.id === questionId)
    if (question?.multiple) {
      setCustomOpenId((prev) => {
        if (prev === questionId) {
          setCustomById((customPrev) => ({ ...customPrev, [questionId]: '' }))
          return null
        }
        return questionId
      })
      return
    }
    setCustomOpenId(questionId)
    setSelectedIdsById((prev) => {
      if (!(questionId in prev)) return prev
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  const setCustomMessage = (questionId: string, message: string) => {
    const question = questions.find((item) => item.id === questionId)
    setCustomById((prev) => ({ ...prev, [questionId]: message }))
    if (!question?.multiple) {
      setSelectedIdsById((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
    }
  }

  const isOptionSelected = (questionId: string, optionId: string): boolean => {
    return (selectedIdsById[questionId] ?? []).includes(optionId)
  }

  return {
    drafts,
    complete,
    selectedById,
    selectedIdsById,
    isOptionSelected,
    customById,
    customOpenId,
    setCustomOpenId,
    selectOption,
    openCustom,
    setCustomMessage
  }
}
