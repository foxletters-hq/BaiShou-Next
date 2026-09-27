import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../Button/Button'
import type { AgentGateQuestion } from '@baishou/shared'
import type { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'
import styles from './AgentGateDock.module.css'

function optionMark(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

export function CompanionAskFields({
  questions,
  isReplying,
  drafts,
  onSkip,
  onSubmit
}: {
  questions: AgentGateQuestion[]
  isReplying: boolean
  drafts: ReturnType<typeof useCompanionAskDrafts>
  onSkip?: () => void
  onSubmit?: () => void
}) {
  const { t } = useTranslation()
  const paged = questions.length > 1
  const [index, setIndex] = useState(0)
  const questionKey = questions.map((item) => item.id).join(':')

  useEffect(() => {
    setIndex(0)
  }, [questionKey])

  const safeIndex = Math.min(index, Math.max(questions.length - 1, 0))
  const visible = paged ? questions.slice(safeIndex, safeIndex + 1) : questions
  const onLast = safeIndex >= questions.length - 1

  return (
    <div className={styles.questionList}>
      {visible.map((question) => {
        const selectedId = drafts.selectedById[question.id]
        const customOpen = drafts.customOpenId === question.id
        const customMark = optionMark(question.options.length)
        return (
          <div key={question.id} className={styles.questionBlock}>
            {paged ? <p className={styles.questionTitle}>{question.question}</p> : null}
            <div className={styles.options} role="radiogroup" aria-label={question.question}>
              {question.options.map((option, optionIndex) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedId === option.id}
                  className={`${styles.option} ${selectedId === option.id ? styles.optionSelected : ''}`}
                  onClick={() => drafts.selectOption(question.id, option.id)}
                >
                  <span className={styles.optionMark}>{optionMark(optionIndex)}</span>
                  <span className={styles.optionLabel}>{option.label}</span>
                </button>
              ))}
              {question.allowCustomInput ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={customOpen}
                  className={`${styles.option} ${customOpen ? styles.optionSelected : ''}`}
                  disabled={isReplying}
                  onClick={() => drafts.openCustom(question.id)}
                >
                  <span className={styles.optionMark}>{customMark}</span>
                  <span className={styles.optionLabel}>
                    {t('agent_gate.custom_answer', '自定义回答')}
                  </span>
                </button>
              ) : null}
            </div>
            {question.allowCustomInput && customOpen ? (
              <textarea
                className={styles.feedbackInput}
                value={drafts.customById[question.id] ?? ''}
                onChange={(event) => drafts.setCustomMessage(question.id, event.target.value)}
                placeholder={t('agent_gate.custom_answer_placeholder', '输入你的回答或说明…')}
                disabled={isReplying}
              />
            ) : null}
          </div>
        )
      })}
      {paged && onSkip && onSubmit ? (
        <div className={styles.askFooter}>
          <div className={styles.askPager}>
            <button
              type="button"
              className={styles.queueNavBtn}
              disabled={safeIndex <= 0 || isReplying}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              aria-label={t('agent_gate.queue_prev', '上一题')}
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </button>
            <p className={styles.askProgress}>
              {t('agent_gate.ask_progress', '{{current}} / {{total}}', {
                current: safeIndex + 1,
                total: questions.length
              })}
            </p>
            <button
              type="button"
              className={styles.queueNavBtn}
              disabled={onLast || isReplying}
              onClick={() =>
                setIndex((current) => Math.min(questions.length - 1, current + 1))
              }
              aria-label={t('agent_gate.queue_next', '下一题')}
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className={styles.askActions}>
            <Button type="button" variant="text" disabled={isReplying} onClick={onSkip}>
              {t('agent_gate.ask_skip', '跳过')}
            </Button>
            <Button
              type="button"
              disabled={isReplying}
              onClick={() => {
                if (!onLast) {
                  setIndex((current) => Math.min(questions.length - 1, current + 1))
                  return
                }
                onSubmit()
              }}
            >
              {onLast
                ? t('agent_gate.confirm', '确认')
                : t('agent_gate.ask_next', '下一题')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
