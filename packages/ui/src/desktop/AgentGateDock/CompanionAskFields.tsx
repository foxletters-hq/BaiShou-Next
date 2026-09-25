import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button/Button'
import type { AgentGateQuestion } from '@baishou/shared'
import type { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'
import styles from './AgentGateDock.module.css'

export function CompanionAskFields({
  questions,
  isReplying,
  drafts
}: {
  questions: AgentGateQuestion[]
  isReplying: boolean
  drafts: ReturnType<typeof useCompanionAskDrafts>
}) {
  const { t } = useTranslation()

  return (
    <div className={styles.questionList}>
      {questions.map((question) => {
        const selectedId = drafts.selectedById[question.id]
        const customOpen = drafts.customOpenId === question.id
        return (
          <div key={question.id} className={styles.questionBlock}>
            {questions.length > 1 ? (
              <p className={styles.questionTitle}>{question.question}</p>
            ) : null}
            <div className={styles.options} role="radiogroup" aria-label={question.question}>
              {question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedId === option.id}
                  className={`${styles.option} ${selectedId === option.id ? styles.optionSelected : ''}`}
                  onClick={() => drafts.selectOption(question.id, option.id)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                </button>
              ))}
            </div>
            {question.allowCustomInput ? (
              customOpen ? (
                <textarea
                  className={styles.feedbackInput}
                  value={drafts.customById[question.id] ?? ''}
                  onChange={(event) => drafts.setCustomMessage(question.id, event.target.value)}
                  placeholder={t('agent_gate.custom_answer_placeholder', '输入你的回答或说明…')}
                  disabled={isReplying}
                />
              ) : (
                <Button
                  type="button"
                  disabled={isReplying}
                  onClick={() => drafts.setCustomOpenId(question.id)}
                >
                  {t('agent_gate.custom_answer', '自定义回答')}
                </Button>
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}