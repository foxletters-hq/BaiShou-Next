import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompanionAskPresentation } from '../../shared/tool-result.util'
import styles from './CompanionAskResultCard.module.css'

export function CompanionAskResultCard({
  data,
  pending = false,
  allowCustomInput = false,
  isReplying = false,
  onSelectOption,
  onSubmitCustom
}: {
  data: CompanionAskPresentation
  pending?: boolean
  allowCustomInput?: boolean
  isReplying?: boolean
  onSelectOption?: (optionId: string) => void
  onSubmitCustom?: (text: string) => void
}) {
  const { t } = useTranslation()
  const selected = new Set(data.selectedOptionIds)
  const showOptions = !data.declined && data.options.length > 0
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  return (
    <section className={styles.card} aria-label={t('agent.tools.companion_ask', '伙伴提问')}>
      <p className={styles.label}>{t('agent.tools.companion_ask_card_label', '提问')}</p>
      {data.question ? <p className={styles.question}>{data.question}</p> : null}
      {data.declined ? (
        <p className={styles.status}>{t('agent.tools.companion_ask_declined', '没有作答')}</p>
      ) : null}
      {showOptions ? (
        <div className={styles.options} role={pending ? 'radiogroup' : 'list'}>
          {data.options.map((option) => {
            const isSelected = selected.has(option.id) || option.label === data.answer
            const className = `${styles.option}${isSelected ? ` ${styles.optionSelected}` : ''}${
              pending ? ` ${styles.optionInteractive}` : ''
            }`
            if (pending && onSelectOption) {
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={className}
                  disabled={isReplying}
                  onClick={() => onSelectOption(option.id)}
                >
                  {option.label}
                </button>
              )
            }
            return (
              <div
                key={option.id}
                role="listitem"
                className={className}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={
                  isSelected
                    ? `${t('agent.tools.companion_ask_selected', '已选择')}：${option.label}`
                    : option.label
                }
              >
                {option.label}
              </div>
            )
          })}
        </div>
      ) : null}
      {!data.declined && !showOptions && data.answer ? (
        <div className={styles.options} role="list">
          <div role="listitem" className={`${styles.option} ${styles.optionSelected}`} aria-current="true">
            {data.answer}
          </div>
        </div>
      ) : null}
      {pending && allowCustomInput && onSubmitCustom && !showCustom ? (
        <button
          type="button"
          className={styles.customToggle}
          disabled={isReplying}
          onClick={() => setShowCustom(true)}
        >
          {t('agent_gate.custom_answer', '自定义回答')}
        </button>
      ) : null}
      {pending && allowCustomInput && onSubmitCustom && showCustom ? (
        <div className={styles.customBox}>
          <textarea
            className={styles.customInput}
            value={customText}
            disabled={isReplying}
            onChange={(event) => setCustomText(event.target.value)}
            placeholder={t('agent_gate.custom_answer_placeholder', '输入你的回答或说明…')}
          />
          <div className={styles.customActions}>
            <button
              type="button"
              className={styles.customToggle}
              disabled={isReplying}
              onClick={() => {
                setShowCustom(false)
                setCustomText('')
              }}
            >
              {t('common.cancel', '取消')}
            </button>
            <button
              type="button"
              className={styles.customSubmit}
              disabled={isReplying || !customText.trim()}
              onClick={() => onSubmitCustom(customText.trim())}
            >
              {t('agent_gate.submit_answer', '提交回答')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
