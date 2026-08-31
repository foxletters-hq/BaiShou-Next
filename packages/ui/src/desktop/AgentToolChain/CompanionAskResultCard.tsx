import React from 'react'
import { useTranslation } from 'react-i18next'
import type { CompanionAskPresentation } from '../../shared/tool-result.util'
import styles from './CompanionAskResultCard.module.css'

export function CompanionAskResultCard({ data }: { data: CompanionAskPresentation }) {
  const { t } = useTranslation()
  const selected = new Set(data.selectedOptionIds)
  const showOptions = !data.declined && data.options.length > 0

  return (
    <section className={styles.card} aria-label={t('agent.tools.companion_ask', '伙伴提问')}>
      <p className={styles.label}>{t('agent.tools.companion_ask_card_label', '提问')}</p>
      {data.question ? <p className={styles.question}>{data.question}</p> : null}
      {data.declined ? (
        <p className={styles.status}>{t('agent.tools.companion_ask_declined', '没有作答')}</p>
      ) : null}
      {showOptions ? (
        <div className={styles.options} role="list">
          {data.options.map((option) => {
            const isSelected = selected.has(option.id) || option.label === data.answer
            return (
              <div
                key={option.id}
                role="listitem"
                className={`${styles.option}${isSelected ? ` ${styles.optionSelected}` : ''}`}
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
    </section>
  )
}
