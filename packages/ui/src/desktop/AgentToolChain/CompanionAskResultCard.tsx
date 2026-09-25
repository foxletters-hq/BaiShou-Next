import React from 'react'
import { useTranslation } from 'react-i18next'
import type { CompanionAskOptionView, CompanionAskPresentation } from '../../shared/tool-result.util'
import styles from './CompanionAskResultCard.module.css'

function CompanionAskResultItem({
  question,
  answer,
  declined,
  options,
  selectedOptionIds
}: {
  question: string
  answer: string | null
  declined: boolean
  options: CompanionAskOptionView[]
  selectedOptionIds: string[]
}) {
  const { t } = useTranslation()
  const selected = new Set(selectedOptionIds)
  const showOptions = !declined && options.length > 0

  return (
    <div className={styles.questionBlock}>
      {question ? <p className={styles.question}>{question}</p> : null}
      {declined ? (
        <p className={styles.status}>{t('agent.tools.companion_ask_declined', '没有作答')}</p>
      ) : null}
      {showOptions ? (
        <div className={styles.options} role="list">
          {options.map((option) => {
            const isSelected = selected.has(option.id) || option.label === answer
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
      {!declined && !showOptions && answer ? (
        <div className={styles.options} role="list">
          <div
            role="listitem"
            className={`${styles.option} ${styles.optionSelected}`}
            aria-current="true"
          >
            {answer}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** 已作答的提问结果，只出现在折叠工具行展开后。 */
export function CompanionAskResultCard({ data }: { data: CompanionAskPresentation }) {
  const { t } = useTranslation()
  const items = data.items && data.items.length > 1 ? data.items : null

  return (
    <section className={styles.card} aria-label={t('agent.tools.companion_ask', '伙伴提问')}>
      <p className={styles.label}>{t('agent.tools.companion_ask_card_label', '提问')}</p>
      {items ? (
        items.map((item, index) => (
          <CompanionAskResultItem
            key={`${item.question}-${index}`}
            question={item.question}
            answer={item.answer}
            declined={data.declined}
            options={item.options}
            selectedOptionIds={item.selectedOptionIds}
          />
        ))
      ) : (
        <CompanionAskResultItem
          question={data.question}
          answer={data.answer}
          declined={data.declined}
          options={data.options}
          selectedOptionIds={data.selectedOptionIds}
        />
      )}
    </section>
  )
}